"""M1: adaptadores de qsv, Miller y Polars para el banco de E0. Solo comparadores de evaluación, no código de producto.

Ninguno se instala en el repositorio: los ejecutables y entornos viven en una carpeta temporal externa (ver README, sección M1).
Las etapas de un mismo comando se encadenan con tuberías del sistema, sin shell, y cada etapa va envuelta en `/usr/bin/time -l`.
"""
import csv
import io
import json
import os
import re
import signal
import subprocess
import time
from pathlib import Path

from common import PROJECT, cents, rows

HERE = Path(__file__).resolve().parent
M1_ENGINES = ['qsv', 'qsvlite', 'miller', 'miller-1t', 'polars', 'polars-1t', 'polars-node', 'polars-node-1t']
# Variantes «-1t»: el mismo motor limitado a un hilo, para compararlo con los que ya son de un hilo (Python, Node, DuckDB con threads=1).
ENV = {'miller-1t': {'GOMAXPROCS': '1'}, 'polars-1t': {'POLARS_MAX_THREADS': '1'}, 'polars-node-1t': {'POLARS_MAX_THREADS': '1'}}
# Miller se usa con su salida por defecto (LF): con --ors crlf reescribe también los saltos de línea DENTRO de campos entrecomillados (ver evidencia M1).


class Unsupported(Exception):
    pass


def _qsv(binary, task, source, output):
    s, o = str(source), str(output)
    oaxaca = [binary, 'search', '--exact', '-s', 'ciudad', 'Oaxaca']
    entregado = [binary, 'search', '--exact', '-s', 'estado', 'entregado']
    if task == 'T1':
        return [[binary, 'count', s]], 'stdout-int', False
    if task == 'T2':
        return [oaxaca + [s], entregado + ['-c', '-o', '/dev/null']], 'stderr-int', False
    if task == 'T3':
        return [oaxaca + [s], entregado, [binary, 'select', ','.join(PROJECT), '-o', o]], 'none', False
    if task == 'T4':
        sql = ("SELECT ciudad, COUNT(*) AS count, CAST(SUM(CAST(total_mxn AS DECIMAL(38,2))) AS VARCHAR) AS s "
               f"FROM read_csv('{s}', infer_schema_length => 0) GROUP BY ciudad ORDER BY ciudad")
        return [[binary, 'sqlp', 'SKIP_INPUT', sql]], 'qsv-sqlp', False
    if task == 'T5':
        return [[binary, 'replace', '--literal', '-s', 'ciudad', '-o', o, '-q', 'Mérida', 'Merida', s]], 'none', False
    if task == 'T6':
        return [[binary, 'search', '--literal', '-c', '-o', '/dev/null', 'Primera línea', s]], 'stderr-int', False
    raise ValueError(task)


def _miller(binary, task, source, output):
    s = str(source)
    base = [binary, '-S']
    where = '$ciudad=="Oaxaca" && $estado=="entregado"'
    if task == 'T1':
        return [base + ['--icsv', '--ojson', 'count', s]], 'miller-count', False
    if task == 'T2':
        return [base + ['--icsv', '--ojson', 'filter', where, 'then', 'count', s]], 'miller-count', False
    if task == 'T3':
        return [base + ['--csv', 'filter', where, 'then', 'cut', '-o', '-f', ','.join(PROJECT), s]], 'none', True
    if task == 'T4':
        dsl = '@c[$ciudad] += 1; @s[$ciudad] += int(sub($total_mxn, "\\.", "")); end{emit (@c, @s), "ciudad"}'
        return [base + ['--icsv', '--ojson', 'put', '-q', dsl, s]], 'miller-groups', False
    if task == 'T5':
        return [base + ['--csv', 'put', '$ciudad = gsub($ciudad, "Mérida", "Merida")', s]], 'none', True
    if task == 'T6':
        return [base + ['--icsv', '--ojson', 'filter', 'joinv($*, "\\x1f") =~ "Primera línea"', 'then', 'count', s]], 'miller-count', False
    raise ValueError(task)


def commands(engine, task, source, output, args):
    """Devuelve (etapas, tipo de resultado, stdout de la última etapa va al archivo de salida)."""
    if engine in ('qsv', 'qsvlite'):
        if engine == 'qsvlite' and task == 'T4':
            raise Unsupported('qsvlite no incluye sqlp ni ningún verbo de agrupación con suma.')
        return _qsv(args.qsv if engine == 'qsv' else args.qsvlite, task, source, output)
    if engine in ('miller', 'miller-1t'):
        return _miller(args.miller, task, source, output)
    if engine in ('polars', 'polars-1t'):
        return [[args.polars_python, '-I', str(HERE / 'polars_worker.py'), task, str(source), str(output)]], 'json', False
    if engine in ('polars-node', 'polars-node-1t'):
        return [[args.node, str(HERE / 'polars_node_worker.mjs'), args.polars_node_dir, task, str(source), str(output)]], 'json', False
    raise ValueError(engine)


def run_pipeline(stages, timeout, sink=None, env=None):
    """Tubería sin shell. Cada etapa se mide con time -l; el RSS informado es el mayor de una sola etapa, no la suma."""
    started = time.perf_counter()
    processes, previous = [], None
    try:
        for index, stage in enumerate(stages):
            last = index == len(stages) - 1
            processes.append(subprocess.Popen(
                ['/usr/bin/time', '-l', *stage], stdin=previous.stdout if previous else subprocess.DEVNULL,
                stdout=(sink if sink else subprocess.PIPE) if last else subprocess.PIPE,
                stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace', env={**os.environ, **env} if env else None,
                process_group=processes[0].pid if processes else 0))  # un grupo propio para poder terminar toda la tubería
            if previous:
                previous.stdout.close()
            previous = processes[-1]
        timed_out = False
        try:
            stdout, stderr = processes[-1].communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(processes[0].pid, signal.SIGKILL)
            stdout, stderr = processes[-1].communicate()
        errors = [stderr] + [p.communicate()[1] for p in processes[:-1]]
    except BaseException:
        for p in processes:
            if p.poll() is None:
                p.kill()
        raise
    elapsed = time.perf_counter() - started
    rss = [int(m[1]) for text in errors if (m := re.search(r'(\d+)\s+maximum resident set size', text))]
    cpu = [tuple(map(float, m.groups())) for text in errors if (m := re.search(r'([\d.]+)\s+real\s+([\d.]+)\s+user\s+([\d.]+)\s+sys', text))]
    return dict(stdout=stdout, stderr=stderr, all_stderr=errors, wall_seconds=elapsed, timed_out=timed_out,
                max_rss_bytes=max(rss) if rss else None, exit_code=max(p.returncode for p in processes),
                stage_exit_codes=[p.returncode for p in processes], stage_rss_bytes=rss,
                cpu_user_seconds=sum(c[1] for c in cpu), cpu_sys_seconds=sum(c[2] for c in cpu))


def parse(kind, run, task):
    if kind == 'stdout-int':
        return {'count': int(run['stdout'].strip())}
    if kind == 'stderr-int':
        # qsv escribe el recuento solo en una línea; las líneas de time -l empiezan con espacios o llevan texto.
        found = re.findall(r'(?m)^(\d+)\s*$', run['stderr'])
        if len(found) != 1:
            raise ValueError(f'No se pudo leer el recuento de qsv: {run["stderr"][:300]!r}')
        return {'count': int(found[0])}
    if kind == 'miller-count':
        data = json.loads(run['stdout'])
        return {'count': data[0]['count'] if data else 0}
    if kind == 'miller-groups':
        data = json.loads(run['stdout'])
        groups = [{'ciudad': g['ciudad'], 'count': g['c'], 'sum_cents': str(g['s'])} for g in sorted(data, key=lambda g: g['ciudad'])]
        return {'count': sum(g['count'] for g in groups), 'groups': groups}
    if kind == 'qsv-sqlp':
        reader = csv.DictReader(io.StringIO(run['stdout']))
        groups = [{'ciudad': r['ciudad'], 'count': int(r['count']), 'sum_cents': str(cents(r['s']))} for r in reader]
        return {'count': sum(g['count'] for g in groups), 'groups': groups}
    if kind == 'json':
        return json.loads(run['stdout'])
    raise ValueError(kind)


def normalized_by(engine):
    return {'qsv': 'qsv (escritor CSV de Rust)', 'qsvlite': 'qsvlite (escritor CSV de Rust)', 'miller': 'Miller (escritor CSV de Go)',
            'polars': 'Polars sink_csv', 'polars-node': 'nodejs-polars sinkCSV'}[engine.removesuffix('-1t')]


def execute_external(engine, task, source, encoding, output, args, finish):
    """Mismo contrato que `benchmark.execute`; `finish` completa recuento, hashes y fidelidad (código común del banco)."""
    result = {'engine': engine, 'task': task}
    try:
        stages, kind, to_file = commands(engine, task, source, output, args)
    except Unsupported as error:
        result.update(wall_seconds=0.0, max_rss_bytes=None, exit_code=None, status='unsupported', error=str(error))
        return result
    sink = open(output, 'xb') if to_file else None
    try:
        run = run_pipeline(stages, args.timeout, sink, ENV.get(engine))
    finally:
        if sink:
            sink.close()
    result.update(wall_seconds=run['wall_seconds'], max_rss_bytes=run['max_rss_bytes'], exit_code=run['exit_code'],
                  stage_exit_codes=run['stage_exit_codes'], stage_rss_bytes=run['stage_rss_bytes'],
                  cpu_user_seconds=run['cpu_user_seconds'], cpu_sys_seconds=run['cpu_sys_seconds'])
    if run['timed_out']:
        result.update(status='timeout', error=f'Grupo de procesos terminado tras {args.timeout}s.')
        return result
    if run['exit_code']:
        result.update(status='error', error='\n'.join(run['all_stderr'])[:4000])
        return result
    try:
        if task in ('T3', 'T5'):
            # El recuento de filas del archivo de salida se verifica fuera del cronómetro, como en DuckDB.
            data = {'count': sum(1 for _ in rows(output, 'utf-8')) - 1}
        else:
            data = parse(kind, run, task)
    except Exception as error:  # salida ilegible = el motor no cumplió el contrato, no un fallo del banco
        result.update(status='error', error=f'Salida no interpretable: {error}')
        return result
    try:
        return finish(result, data, normalized_by(engine))
    except Exception as error:  # p. ej. una salida que no se puede decodificar en la codificación de la fuente
        result.update(status='error', error=f'Salida no verificable: {type(error).__name__}: {error}')
        return result
