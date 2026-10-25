"""M1: ¿qué pasa con un CSV que atraviesa cada herramienta SIN ninguna transformación?

Pasa seis fixtures pequeños por «copiar todas las columnas» en cada herramienta y compara tres niveles por separado:
valores (lo que lee un analizador independiente), estructura (campos por registro) y bytes (registros idénticos al original).
También documenta dos trampas de configuración que cambian los valores sin avisar. Solo comparador de evaluación.
"""
import argparse
import csv
import datetime
import io
import json
import platform
import subprocess
from pathlib import Path

from common import raw_records, file_hash

HERE = Path(__file__).resolve().parent


def make_fixtures(folder):
    def write(name, text=None, data=None):
        path = folder / f'{name}.csv'
        path.write_bytes(data if data is not None else text.encode('utf-8'))
        return path
    plain = [['id', 'zip', 'nombre', 'nota'], ['00123', '01000', 'Ana', 'x'], ['9007199254740993', '72000', 'José', ''], ['3', '97000', 'Zoë', 'fin']]
    stream = io.StringIO(newline='')
    csv.writer(stream, quoting=csv.QUOTE_ALL, lineterminator='\r\n').writerows(plain)
    hostile = ('id,zip,nombre,nota\r\n'
               '00123,01000," Ana ",""\r\n'                       # espacios y vacío entrecomillado
               '2,72000,"dice ""hola""","línea 1\nlínea 2"\r\n'   # comillas dobles y LF dentro de campo
               '3,97000,"a,b","línea 1\r\nlínea 2"\r\n'           # coma y CRLF dentro de campo
               '4,,,\r\n')                                         # vacíos sin comillas
    return {
        'minimal_crlf': write('minimal_crlf', '\r\n'.join(','.join(r) for r in plain) + '\r\n'),
        'minimal_lf': write('minimal_lf', '\n'.join(','.join(r) for r in plain) + '\n'),
        'quote_all': write('quote_all', stream.getvalue()),
        'hostile': write('hostile', hostile),
        'ragged': write('ragged', 'id,zip,nombre,nota\r\n1,01000,Ana\r\n2,72000,José,x\r\n'),
        'bom_utf8': write('bom_utf8', data=b'\xef\xbb\xbf' + '\r\n'.join(','.join(r) for r in plain).encode('utf-8') + b'\r\n'),
    }


def passthrough(tool, source, output, args, header):
    """Comando «copiar todas las columnas» de cada herramienta, con su configuración por defecto salvo lo indicado."""
    s, o = str(source), str(output)
    polars_code = ("import polars as pl,sys;pl.scan_csv(sys.argv[1],infer_schema=False,encoding='utf8').sink_csv(sys.argv[2]{extra})")
    names = ','.join(f"'{h}'" for h in header)
    duck = ("SET autoinstall_known_extensions=false; SET autoload_known_extensions=false; SET threads=1; "
            f"COPY (SELECT * FROM read_csv('{s}', header=true, all_varchar=true, force_not_null=[{names}], strict_mode=true, parallel=false)) TO '{o}' (FORMAT CSV, HEADER);")
    node_code = ("const {createRequire}=require('node:module');const pl=createRequire(process.argv[1]+'/package.json')('nodejs-polars');"
                 "pl.scanCSV(process.argv[2],{inferSchemaLength:0,encoding:'utf8'}).sinkCSV(process.argv[3]{extra}).collectSync()")
    return {
        'qsv': [args.qsv, 'select', '1-', '-o', o, s],
        'qsvlite': [args.qsvlite, 'select', '1-', '-o', o, s],
        'miller': [args.miller, '-S', '--csv', 'cat', s],                                  # stdout → archivo
        'miller_ors_crlf': [args.miller, '-S', '--csv', '--ors', 'crlf', 'cat', s],        # trampa 1
        'polars': [args.polars_python, '-I', '-c', polars_code.replace('{extra}', ''), s, o],
        'polars_crlf': [args.polars_python, '-I', '-c', polars_code.replace('{extra}', ",line_terminator='\\r\\n'"), s, o],
        'polars_node': [args.node, '-e', node_code.replace('{extra}', ''), args.polars_node_dir, s, o],
        'polars_node_crlf': [args.node, '-e', node_code.replace('{extra}', ",{lineTerminator:'\\r\\n'}"), args.polars_node_dir, s, o],
        'duckdb': [args.duckdb, '-no-init', '-batch', '-bail', ':memory:', '-c', duck],
    }


def read(path):
    data = Path(path).read_bytes()
    text = data.decode('utf-8-sig')
    return list(csv.reader(io.StringIO(text, newline=''), strict=True)), data


def strip(raw):
    return raw[:-2] if raw.endswith(b'\r\n') else raw[:-1] if raw.endswith(b'\n') else raw


def assess(source, output):
    expected, original = read(source)
    try:
        actual, data = read(output)
    except (csv.Error, UnicodeError, OSError) as error:
        return {'status': 'salida ilegible', 'error': f'{type(error).__name__}: {error}'}
    src_records = [raw for _, raw in raw_records(source, 'utf-8-sig' if original.startswith(b'\xef\xbb\xbf') else 'utf-8')]
    out_records = [raw for _, raw in raw_records(output, 'utf-8-sig' if data.startswith(b'\xef\xbb\xbf') else 'utf-8')]
    return {'status': 'ok',
            'values_equal': actual == expected,
            'structure_equal': [len(r) for r in actual] == [len(r) for r in expected],
            'bytes_equal': data == original,
            'records_bytes_equal': src_records == out_records,
            'records_bytes_equal_ignoring_final_eol': [strip(r) for r in src_records] == [strip(r) for r in out_records],
            'bom_preserved': data.startswith(b'\xef\xbb\xbf') == original.startswith(b'\xef\xbb\xbf'),
            'source_arity': [len(r) for r in expected], 'output_arity': [len(r) for r in actual]}


def run(args):
    if platform.system() != 'Darwin':
        raise SystemExit('Medido solo en macOS ARM64.')
    folder = args.output.resolve()
    if folder.is_relative_to(HERE.parents[1]):
        raise SystemExit('La salida debe estar fuera del repositorio.')
    folder.mkdir(parents=True, exist_ok=False)
    sources = make_fixtures(folder)
    report = {'schema': 1, 'kind': 'M1 identidad: copiar sin transformar', 'consulted_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'platform': platform.platform(), 'results': [], 'fixtures_sha256': {n: file_hash(p) for n, p in sources.items()}}
    for fname, source in sources.items():
        header = next(csv.reader(io.StringIO(source.read_bytes().decode('utf-8-sig'), newline='')))
        for tool in passthrough('', source, folder / 'unused', args, header):
            output = folder / f'{fname}.{tool}.out.csv'
            command = passthrough(tool, source, output, args, header)[tool]
            stdout_to_file = tool.startswith('miller')
            try:
                with (open(output, 'xb') if stdout_to_file else open('/dev/null', 'wb')) as sink:
                    done = subprocess.run(command, stdout=sink, stderr=subprocess.PIPE, timeout=60, stdin=subprocess.DEVNULL)
                entry = {'fixture': fname, 'tool': tool, 'exit_code': done.returncode}
                if done.returncode:
                    entry.update(status='error', error=done.stderr.decode('utf-8', 'replace')[:500])
                else:
                    entry.update(assess(source, output))
            except subprocess.TimeoutExpired:
                entry = {'fixture': fname, 'tool': tool, 'status': 'timeout'}
            report['results'].append(entry)
            print(fname, tool, entry.get('status'), {k: entry[k] for k in ('values_equal', 'structure_equal', 'records_bytes_equal', 'records_bytes_equal_ignoring_final_eol') if k in entry}, flush=True)
    report['sources_unchanged'] = {n: file_hash(p) == report['fixtures_sha256'][n] for n, p in sources.items()}
    (folder / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--qsv', required=True)
    parser.add_argument('--qsvlite', required=True)
    parser.add_argument('--miller', required=True)
    parser.add_argument('--polars-python', required=True)
    parser.add_argument('--polars-node-dir', required=True)
    parser.add_argument('--node', required=True)
    parser.add_argument('--duckdb', default='/opt/homebrew/bin/duckdb')
    run(parser.parse_args())
