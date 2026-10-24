"""Sondeo manual E0 de límites; no instala herramientas ni importa el producto.

Usa los mismos ejecutables/flags que benchmark.py y escribe sólo en una carpeta
externa nueva. Sale con 2 si algún motor pierde estructura, acepta entrada inválida,
agota el tiempo o no permite concluir; eso no equivale a una prueba de paridad verde.
"""
import argparse
import csv
import datetime
import io
import json
import math
import platform
import sys
from pathlib import Path

from benchmark import HERE, execute
from common import PROJECT, fidelity, file_hash, rows, value_hash

ENGINES = ['python', 'node', 'duckdb', 'pandas']
DEFAULT_HEADER = Path('/private/tmp/FreyaLab-pruebas/ventas_10MiB.csv')


def csv_text(records):
    stream = io.StringIO(newline='')
    csv.writer(stream, quoting=csv.QUOTE_ALL).writerows(records)
    return stream.getvalue()


def rejection_from_oracle(source, encoding, error_type):
    try:
        list(rows(source, encoding))
    except error_type as error:
        return {'error_type': type(error).__name__, 'error': str(error)}
    raise AssertionError(f'El fixture {source.name} no es inválido según el oráculo.')


def fixtures(folder, header_source):
    header = next(rows(header_source, 'utf-8'))
    assert len(header) == 21, f'Esperadas 21 columnas reales, recibidas {len(header)}.'
    assert len(set(header)) == 21
    for name in PROJECT + ['estado', 'notas']:
        assert name in header
    assert header[-1] == 'notas', 'El campo ausente debe ser la última posición: notas.'
    city = header.index('ciudad')

    def record(identifier, location, note):
        values = [''] * len(header)
        for name, value in {'venta_id': identifier, 'ciudad': location,
                            'producto': '"artículo", €', 'total_mxn': '1.00',
                            'estado': 'entregado', 'notas': note}.items():
            values[header.index(name)] = value
        return values

    irregular = folder / 'irregular.csv'
    source_rows = [header, record('00123', 'Mérida', '')[:-1],
                   record('900719925474099312345678', 'Mérida', ''),
                   record('0000', 'Oaxaca', 'Primera línea\nSegunda línea')]
    irregular.write_bytes(csv_text(source_rows).encode('utf-8'))
    parsed = list(rows(irregular, 'utf-8'))
    assert parsed == source_rows
    assert [len(row) for row in parsed] == [21, 20, 21, 21]
    assert parsed[2][-1] == '' and len(parsed[1]) == len(parsed[2]) - 1
    assert value_hash([parsed[1]]) != value_hash([parsed[1] + ['']])
    expected = [row.copy() for row in parsed]
    for row in expected[1:]:
        row[city] = row[city].replace('Mérida', 'Merida')
    assert [len(row) for row in expected] == [21, 20, 21, 21]

    malformed = folder / 'malformed-quote.csv'
    valid = csv_text([header, record('0001', 'Mérida', 'sin cierre')])
    assert valid.endswith('"sin cierre"\r\n')
    malformed.write_bytes((valid[:-3] + '\r\n').encode('utf-8'))
    malformed_error = rejection_from_oracle(malformed, 'utf-8', csv.Error)

    odd = folder / 'utf16-odd.csv'
    odd.write_bytes(csv_text([header, record('0002', 'Mérida', 'completo')]).encode('utf-16') + b'\x00')
    assert odd.read_bytes().startswith(b'\xff\xfe') and odd.stat().st_size % 2 == 1
    odd_error = rejection_from_oracle(odd, 'utf-16', UnicodeError)
    return [
        {'name': 'irregular', 'source': irregular, 'encoding': 'utf-8', 'task': 'T5',
         'oracle': {'arity_including_header': [21, 20, 21, 21],
                                         'data_records': 3, 'values_sha256': value_hash(expected)}},
        {'name': 'malformed_quote', 'source': malformed, 'encoding': 'utf-8', 'task': 'T1',
         'oracle': malformed_error},
        {'name': 'utf16_odd', 'source': odd, 'encoding': 'utf-16', 'task': 'T1',
         'oracle': odd_error},
    ]


def assess(case, result, output):
    status = result['status']
    if case['name'] != 'irregular':
        error = result.get('error', '').lower()
        parse_markers = ['_csv.error:', 'pandas.errors.parsererror:', 'csv error',
                         'error tokenizing data', 'error when sniffing file',
                         'unexpected end of data', 'unterminated', 'unclosed quoted',
                         'unicodedecodeerror:', 'truncated data', 'could not decode',
                         'invalid unicode', 'invalid utf-16', 'invalid utf16']
        recognized = status == 'error' and any(marker in error for marker in parse_markers)
        return {'expected': 'rechazar el CSV malformado o los bytes UTF-16 incompletos',
                'correct_rejection_observed': recognized,
                'accepted_invalid_input': status == 'measured',
                'guarantee_met': recognized,
                'assessment': 'rechazo de parsing/decodificación observado' if recognized else
                              'entrada inválida aceptada: limitación' if status == 'measured' else
                              'timeout: no es un rechazo correcto' if status == 'timeout' else
                              'error no atribuido al parsing: resultado no concluyente'}

    observed = {'expected': 'T5 conserva todas las posiciones y cambia sólo ciudad',
                'arity_preserved': None, 'values_match_expected': None, 'guarantee_met': False}
    if output.exists():
        try:
            encoding = result.get('output_encoding', case['encoding'])
            actual = list(rows(output, encoding))
            observed['arity_including_header'] = [len(row) for row in actual]
            observed['arity_preserved'] = observed['arity_including_header'] == case['oracle']['arity_including_header']
            observed['values_sha256'] = value_hash(actual)
            observed['values_match_expected'] = observed['values_sha256'] == case['oracle']['values_sha256']
            if 'fidelity' not in result:
                observed['fidelity'] = fidelity(case['source'], output, case['encoding'], encoding)
        except (csv.Error, UnicodeError, OSError, ValueError) as error:
            observed['output_validation_error'] = f'{type(error).__name__}: {error}'
    observed['guarantee_met'] = (status == 'measured' and observed['arity_preserved'] is True
                                 and observed['values_match_expected'] is True
                                 and result.get('result', {}).get('count') == 3)
    observed['assessment'] = ('valores y aridad conservados' if observed['guarantee_met'] else
                              'pérdida de aridad o valores: limitación' if status == 'measured' else
                              'estructura irregular rechazada o error: no acredita soporte')
    return observed


def run(args):
    if platform.system() != 'Darwin':
        raise SystemExit('execute usa time -l de macOS; no atribuir resultados a otros sistemas.')
    source_header = (args.files[0] if args.files else DEFAULT_HEADER).resolve()
    destination = args.output.resolve()
    if destination.is_relative_to(HERE.parents[1]) or destination.is_relative_to(source_header.parent):
        raise SystemExit('La salida debe ser externa al repositorio y a la carpeta de la fuente.')
    destination.mkdir(parents=True, exist_ok=False)
    fixture_dir, outputs, scratch = [destination / name for name in ['fixtures', 'outputs', 'scratch']]
    for folder in [fixture_dir, outputs, scratch]:
        folder.mkdir()
    header_sha = file_hash(source_header)
    report = {'schema': 1, 'kind': 'E0 edge probes; no benchmark de rendimiento',
              'consulted_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'platform': platform.platform(), 'machine': platform.machine(),
              'header_source': str(source_header), 'header_source_sha256_before': header_sha,
              'executables': {name: str(value) for name, value in vars(args).items()
                              if name in ['python', 'pandas_python', 'node', 'duckdb']},
              'script_sha256': {path.name: file_hash(path) for path in
                                [Path(__file__).resolve(), HERE / 'benchmark.py', HERE / 'common.py',
                                 HERE / 'python_worker.py', HERE / 'node_worker.mjs']},
              'method': 'fixtures sintéticos; execute reutilizado; UTF-16 impar limitado a 2s y grupo de procesos terminado si expira; tiempos son observaciones, no comparativa de rendimiento',
              'known_limitations_to_check': [
                  'pandas puede rellenar posiciones ausentes y perder aridad aunque dtype sea texto',
                  'el scanner Node PoC puede aceptar comillas malformadas en T1',
                  'el scanner Node PoC puede no avanzar ante UTF-16 impar; timeout no equivale a rechazo',
                  'un fallo del harness/preparación no acredita que el motor rechace el archivo',
                  'fuente intacta no demuestra fidelidad del resultado ni empaquetado multiplataforma'],
              'fixtures': [], 'results': []}
    report_path = destination / 'results.json'

    def save():
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    try:
        cases = fixtures(fixture_dir, source_header)
        for case in cases:
            original = file_hash(case['source'])
            entry = {'name': case['name'], 'source': str(case['source']), 'encoding': case['encoding'],
                     'task': case['task'], 'bytes': case['source'].stat().st_size,
                     'sha256_before': original, 'oracle': case['oracle']}
            report['fixtures'].append(entry)
            for engine in ENGINES:
                output = outputs / f'{case["name"]}-{engine}-{case["task"]}.csv'
                execution_args = argparse.Namespace(**vars(args))
                if case['name'] == 'utf16_odd':
                    execution_args.timeout = 2.0
                try:
                    result = execute(engine, case['task'], case['source'], case['encoding'], output,
                                     scratch / f'{case["name"]}-{engine}', execution_args)
                except Exception as error:
                    result = {'engine': engine, 'task': case['task'], 'status': 'harness_error',
                              'error': f'{type(error).__name__}: {error}',
                              'engine_rejection_not_proven': True}
                result.update(fixture=case['name'], encoding=case['encoding'],
                              timeout_seconds=execution_args.timeout, output=str(output),
                              original_sha256_unchanged=file_hash(case['source']) == original)
                result['probe'] = assess(case, result, output)
                result['probe']['guarantee_met'] &= result['original_sha256_unchanged']
                if not result['original_sha256_unchanged']:
                    result['probe']['assessment'] = 'CRÍTICO: cambió el hash de la fuente'
                report['results'].append(result)
                save()
                print(f'{case["name"]} {engine}: {result["probe"]["assessment"]}', flush=True)
            entry['sha256_after'] = file_hash(case['source'])
            entry['original_sha256_unchanged'] = entry['sha256_after'] == original
    finally:
        report['header_source_sha256_after'] = file_hash(source_header)
        report['header_source_unchanged'] = report['header_source_sha256_after'] == header_sha
        report['all_probes_completed'] = len(report['results']) == 3 * len(ENGINES)
        report['all_guarantees_met'] = (report['all_probes_completed'] and report['header_source_unchanged']
                                        and all(item['probe']['guarantee_met'] for item in report['results'])
                                        and all(item.get('original_sha256_unchanged', False)
                                                for item in report['fixtures']))
        save()
    print(f'Resultados: {report_path}; garantías completas: {report["all_guarantees_met"]}', flush=True)
    return 0 if report['all_guarantees_met'] else 2


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='*', type=Path, help='Fuente del encabezado; máximo una. No se transforma.')
    parser.add_argument('--micro', action='store_true', help='Compatibilidad con benchmark.py: estos fixtures siempre son micro.')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--python', default=sys.executable)
    parser.add_argument('--pandas-python', required=True)
    parser.add_argument('--node', required=True)
    parser.add_argument('--duckdb', default='/opt/homebrew/bin/duckdb')
    parser.add_argument('--timeout', type=float, default=900)
    args = parser.parse_args()
    if len(args.files) > 1:
        parser.error('Se admite una sola fuente de encabezado; los tres casos son fixtures sintéticos.')
    if not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error('--timeout debe ser finito y positivo.')
    raise SystemExit(run(args))
