"""Banco manual E0: nunca importa el producto ni instala herramientas."""
import argparse
import csv
import datetime
import hashlib
import json
import os
import platform
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path
from common import PROJECT, cents, fidelity, file_hash, rows, value_hash
from m1_engines import M1_ENGINES, execute_external

HERE = Path(__file__).resolve().parent
TASKS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
E0_ENGINES = ['python', 'node', 'duckdb', 'pandas']
# M1: (hilos, memory_limit, lector CSV paralelo). `duckdb-mt` sube los hilos pero E0 fuerza parallel=false en el lector (más estricto) y casi no los usa.
DUCK_VARIANTS = {'duckdb': (1, '512MB', False), 'duckdb-mt': (12, '4GB', False), 'duckdb-par': (12, '4GB', True),
                 'duckdb-node': (1, '512MB', False), 'duckdb-node-par': (12, '4GB', True)}  # M2: las dos últimas usan @duckdb/node-api


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def identifier(name):
    return '"' + name.replace('"', '""') + '"'


def duck_sql(task, source, encoding, output, scratch, threads=1, memory='512MB', parallel=False):
    header = next(rows(source, encoding))
    if len(header) != len(set(header)):
        raise ValueError('Cabeceras duplicadas: no aceptar renombrado automático.')
    for name in PROJECT + ['estado']:
        header.index(name)
    encoding = {'utf-8-sig': 'utf-8', 'cp1252': 'windows-1252'}.get(encoding, encoding)
    # No sentinel para NULL que pueda colisionar con un valor real; forzar texto no nulo.
    read = (f'read_csv({quote(source)}, header=true, delim=\',\', all_varchar=true, '
            f'encoding={quote(encoding)}, force_not_null=[{",".join(map(quote, header))}], '
            f'strict_mode=true, parallel={str(parallel).lower()})')
    where = "ciudad = 'Oaxaca' AND estado = 'entregado'"
    statements = {
        'T1': 'SELECT count(*) AS count FROM t',
        'T2': f'SELECT count(*) AS count FROM t WHERE {where}',
        'T3': f'COPY (SELECT {",".join(map(identifier, PROJECT))} FROM t WHERE {where}) TO {quote(output)} (FORMAT CSV, HEADER)',
        'T4': 'SELECT ciudad, count(*) AS count, CAST(SUM(CAST(total_mxn AS DECIMAL(38,2))) AS VARCHAR) AS sum_amount FROM t GROUP BY ciudad ORDER BY ciudad',
        'T5': f'COPY (SELECT * REPLACE (replace(ciudad, \'Mérida\', \'Merida\') AS ciudad) FROM t) TO {quote(output)} (FORMAT CSV, HEADER)',
        'T6': 'SELECT count(*) AS count FROM t WHERE ' + ' OR '.join(f'contains({identifier(name)}, \'Primera línea\')' for name in header),
    }
    return ("SET autoinstall_known_extensions=false; SET autoload_known_extensions=false; "
            f"SET threads={threads}; SET memory_limit='{memory}'; SET preserve_insertion_order=true; "
            f'SET temp_directory={quote(scratch)}; CREATE TEMP VIEW t AS SELECT * FROM {read}; {statements[task]};')


def finish_external(result, data, label, task, source, encoding, output):
    # Misma verificación que las rutas de E0 (fuera del cronómetro); las herramientas M1 escriben en la codificación de la fuente.
    result['result'] = data
    result['status'] = 'measured'
    result['result_sha256'] = hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    if task in ['T3', 'T5']:
        result.update(output_bytes=output.stat().st_size, output_sha256=file_hash(output),
                      values_sha256=value_hash(rows(output, encoding if encoding != 'utf-8-sig' else 'utf-8')), output_encoding=encoding)
        result['fidelity'] = fidelity(source, output, encoding, encoding) if task == 'T5' else {
            'whole_record_byte_equality': 'no aplicable: proyección de columnas', 'normalized_by': label}
        if task == 'T5':
            result['fidelity']['normalized_by'] = label
    return result


def execute(engine, task, source, encoding, output, scratch, args):
    if output.exists() or source.resolve() == output.resolve():
        raise ValueError('Salida existente o igual al original.')
    if engine in M1_ENGINES:
        return execute_external(engine, task, source, encoding, output, args,
                                lambda result, data, label: finish_external(result, data, label, task, source, encoding, output))
    if engine.startswith('duckdb-node'):
        command = [args.node, str(HERE / 'duckdb_node_worker.mjs'), duck_sql(task, source, encoding, output, scratch, *DUCK_VARIANTS[engine])]
    elif engine in DUCK_VARIANTS:
        command = [args.duckdb, '-no-init', '-batch', '-bail', '-json', ':memory:', '-c', duck_sql(task, source, encoding, output, scratch, *DUCK_VARIANTS[engine])]
    elif engine == 'node':
        command = [args.node, str(HERE / 'node_worker.mjs'), task, str(source), encoding, str(output)]
    else:
        python = args.pandas_python if engine == 'pandas' else args.python
        command = [python, str(HERE / 'python_worker.py'), engine, task, str(source), encoding, str(output)]
    started = time.perf_counter()
    process = subprocess.Popen(['/usr/bin/time', '-l', *command], text=True, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, start_new_session=True)
    timed_out = False
    try:
        stdout, stderr = process.communicate(timeout=args.timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGKILL)
        stdout, stderr = process.communicate()
    elapsed = time.perf_counter() - started
    rss = re.search(r'(\d+)\s+maximum resident set size', stderr)
    cpu = re.search(r'([\d.]+)\s+real\s+([\d.]+)\s+user\s+([\d.]+)\s+sys', stderr)
    result = {'engine': engine, 'task': task, 'wall_seconds': elapsed,
              'max_rss_bytes': int(rss[1]) if rss else None, 'exit_code': process.returncode,
              'cpu_user_seconds': float(cpu[2]) if cpu else None, 'cpu_sys_seconds': float(cpu[3]) if cpu else None}
    if timed_out:
        result.update(status='timeout', error=f'Grupo de procesos terminado tras {args.timeout}s.')
        return result
    if process.returncode:
        result['error'] = stderr[:4000]
        result['status'] = 'unsupported' if engine in DUCK_VARIANTS and encoding == 'cp1252' and 'encoding' in stderr.lower() else 'error'
        return result
    if engine in DUCK_VARIANTS and task in ['T3', 'T5']:
        # COPY no devuelve JSON en esta CLI; recuento de verificación fuera del cronómetro.
        data = {'count': sum(1 for _ in rows(output, 'utf-8')) - 1}
    else:
        data = json.loads(stdout)
    if engine in DUCK_VARIANTS and task not in ['T3', 'T5']:
        if task == 'T4':
            data = {'count': sum(row['count'] for row in data),
                    'groups': [{'ciudad': row['ciudad'], 'count': row['count'], 'sum_cents': str(cents(row['sum_amount']))} for row in data]}
        else:
            data = {'count': data[0].get('count', data[0].get('Count'))}
    result['result'] = data
    result['status'] = 'measured'
    result['result_sha256'] = hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    if task in ['T3', 'T5']:
        output_encoding = 'utf-8' if engine in DUCK_VARIANTS else encoding
        result.update(output_bytes=output.stat().st_size, output_sha256=file_hash(output),
                      values_sha256=value_hash(rows(output, output_encoding)), output_encoding=output_encoding)
        if task == 'T5':
            result['fidelity'] = fidelity(source, output, encoding, output_encoding)
        else:
            result['fidelity'] = {'whole_record_byte_equality': 'no aplicable: proyección de columnas',
                                  'normalized_by': 'DuckDB COPY' if engine in DUCK_VARIANTS else 'Python csv.writer' if engine in ['python', 'pandas'] else 'PoC bulkTransform; campos proyectados serializados'}
    return result


def micro_fixture(folder):
    header = next(rows(Path('/private/tmp/FreyaLab-pruebas/ventas_10MiB.csv'), 'utf-8'))
    base = [''] * len(header)
    def record(city, amount, identifier_value, note):
        row = base.copy()
        for name, value in {'venta_id': identifier_value, 'ciudad': city, 'producto': '"artículo", €', 'total_mxn': amount,
                            'estado': 'entregado', 'notas': note}.items():
            row[header.index(name)] = value
        return row
    records = [header, record('Oaxaca', '9007199254740993.01', '00123', 'Primera línea\nSegunda línea'),
               record('Mérida', '-0.01', '900719925474099312345678', 'comillas "dobles"'),
               record('Oaxaca', '2.00', '0000', '')]
    paths = []
    for encoding in ['utf-8', 'utf-8-sig', 'utf-16', 'cp1252']:
        source = folder / f'format-{encoding}.csv'
        with source.open('x', encoding=encoding, newline='') as stream:
            csv.writer(stream, quoting=csv.QUOTE_ALL).writerows(records)
        paths.append((source, encoding))
    return paths


def run(args):
    if platform.system() != 'Darwin':
        raise SystemExit('Este banco usa time -l de macOS; adaptar RSS antes de medir otro SO.')
    if args.output.resolve().is_relative_to(HERE.parents[1]):
        raise SystemExit('Los datos temporales deben estar fuera del repositorio.')
    if not args.micro and any(args.output.resolve().is_relative_to(path.resolve().parent) for path in args.files):
        raise SystemExit('No escribir temporales en la carpeta de las fuentes.')
    args.output.mkdir(parents=True, exist_ok=False)
    scratch = args.output / 'artifacts'
    scratch.mkdir()
    report = {'schema': 1, 'consulted_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'base_sha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=HERE, text=True).strip(),
              'platform': platform.platform(), 'machine': platform.machine(),
              'hardware': subprocess.check_output(['sysctl', '-n', 'machdep.cpu.brand_string', 'hw.memsize'], text=True).splitlines(),
              'method': 'una repetición, un proceso por motor/tarea, caché caliente por SHA-256 previo, time -l RSS bytes, pared incluye arranque; verificación excluida del tiempo',
              'versions': {}, 'files': [], 'results': []}
    scripts = list(HERE.glob('*.py')) + list(HERE.glob('*.mjs')) + list((HERE.parent / 'large-file-editor' / 'lib').glob('*.mjs'))
    report['script_sha256'] = {str(path.relative_to(HERE.parent)): file_hash(path) for path in sorted(scripts)}
    version_commands = {'python': [args.python, '--version'], 'node': [args.node, '--version'], 'duckdb': [args.duckdb, '--version']}
    if 'pandas' in args.engines:
        version_commands['pandas'] = [args.pandas_python, '-c', 'import sys,pandas; print(sys.version.split()[0], pandas.__version__)']
    if 'qsv' in args.engines:
        version_commands['qsv'] = [args.qsv, '--version']
    if 'qsvlite' in args.engines:
        version_commands['qsvlite'] = [args.qsvlite, '--version']
    if 'miller' in args.engines:
        version_commands['miller'] = [args.miller, '--version']
    if 'polars' in args.engines:
        version_commands['polars'] = [args.polars_python, '-I', '-c', 'import sys,polars; print(sys.version.split()[0], polars.__version__)']
    if 'polars-node' in args.engines:
        version_commands['polars-node'] = [args.node, '-e', f"const p=require('node:path');console.log(require(p.join({json.dumps(args.polars_node_dir)},'node_modules/nodejs-polars/package.json')).version)"]
    if any(e.startswith('duckdb-node') for e in args.engines):
        version_commands['duckdb-node'] = [args.node, '-e', f"const p=require('node:path');const d=require(p.join({json.dumps(os.environ.get('DUCKDB_NODE_DIR', ''))},'node_modules/@duckdb/node-api'));d.DuckDBInstance.create(':memory:').then(async i=>{{const c=await i.connect();console.log('@duckdb/node-api 2.0.0-r.1, DuckDB',(await c.runAndReadAll('select version() v')).getRows()[0][0])}})"]
    for name, command in version_commands.items():
        report['versions'][name] = subprocess.check_output(command, text=True).strip().splitlines()[0]
    report['engines'] = args.engines
    report['binaries_sha256'] = {name: file_hash(Path(path)) for name, path in {'qsv': args.qsv, 'qsvlite': args.qsvlite, 'miller': args.miller}.items() if name in args.engines}
    sources = micro_fixture(scratch) if args.micro else [(path.resolve(), 'utf-8') for path in args.files]
    destination = args.output / 'results.json'
    try:
        for source, encoding in sources:
            if shutil.disk_usage(scratch).free < source.stat().st_size * 3 + 128 * 1024**2:
                raise OSError('Espacio insuficiente: presupuesto 3× fuente +128MiB.')
            original = file_hash(source)
            report['files'].append({'file': source.name, 'bytes': source.stat().st_size, 'encoding': encoding, 'sha256_before': original})
            expected = {}
            for engine in args.engines:
                for task in TASKS:
                    assert file_hash(source) == original  # calienta caché y comprueba original
                    output = scratch / f'{source.stem}-{engine}-{task}.csv'
                    try:
                        result = execute(engine, task, source, encoding, output, scratch / 'duck-temp', args)
                    except Exception as error:
                        output.unlink(missing_ok=True)
                        raise RuntimeError(f'{engine}/{task}: {error}') from error
                    result.update(file=source.name, encoding=encoding)
                    if engine == 'python':
                        if result['exit_code']:
                            raise RuntimeError(result['error'])
                        expected[task] = result
                    if result['exit_code'] == 0 and result.get('status') == 'measured':
                        result['matches_oracle'] = result['result_sha256'] == expected[task]['result_sha256']
                        if task in ['T3', 'T5']:
                            result['matches_oracle'] &= result['values_sha256'] == expected[task]['values_sha256']
                    report['results'].append(result)
                    print(f'{source.name} {engine} {task}: {result["wall_seconds"]:.3f}s match={result.get("matches_oracle", "error")}', flush=True)
                    # Sólo salidas creadas por esta ejecución. No se guardan los datos en Git.
                    output.unlink(missing_ok=True)
                    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
            report['files'][-1]['sha256_after'] = file_hash(source)
            assert report['files'][-1]['sha256_after'] == original
    finally:
        destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if any(row.get('matches_oracle') is False or row['status'] not in ['measured', 'unsupported'] for row in report['results']):
        raise SystemExit('Errores o discrepancias: consultar JSON; no declarar paridad.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('files', nargs='*', type=Path)
    parser.add_argument('--micro', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--python', default=sys.executable)
    parser.add_argument('--pandas-python')
    parser.add_argument('--engines', default=','.join(E0_ENGINES), help='lista separada por comas; python debe ir primero (oráculo)')
    parser.add_argument('--qsv')
    parser.add_argument('--qsvlite')
    parser.add_argument('--miller')
    parser.add_argument('--polars-python', help='intérprete de un entorno externo con polars')
    parser.add_argument('--polars-node-dir', help='carpeta externa con node_modules/nodejs-polars')
    parser.add_argument('--node', required=True)
    parser.add_argument('--duckdb', default='/opt/homebrew/bin/duckdb')
    parser.add_argument('--duckdb-node-dir', help='carpeta externa con node_modules/@duckdb/node-api (variable DUCKDB_NODE_DIR)')
    parser.add_argument('--timeout', type=float, default=900)
    args = parser.parse_args()
    args.engines = args.engines.split(',')
    if args.duckdb_node_dir:
        os.environ['DUCKDB_NODE_DIR'] = args.duckdb_node_dir
    if any(e.startswith('duckdb-node') for e in args.engines) and not os.environ.get('DUCKDB_NODE_DIR'):
        parser.error('duckdb-node necesita --duckdb-node-dir.')
    unknown = set(args.engines) - set(E0_ENGINES) - set(M1_ENGINES) - set(DUCK_VARIANTS)
    if unknown or args.engines[0] != 'python':
        parser.error(f'Motores no válidos o python no es el primero: {sorted(unknown)}')
    needs = {'pandas': args.pandas_python, 'qsv': args.qsv, 'qsvlite': args.qsvlite, 'miller': args.miller, 'polars': args.polars_python, 'polars-node': args.polars_node_dir}
    missing = [name for name in args.engines if name in needs and not needs[name]]
    if missing:
        parser.error(f'Falta la ruta de: {missing}')
    if not args.micro and not args.files:
        parser.error('Indicar fuentes o --micro.')
    run(args)
