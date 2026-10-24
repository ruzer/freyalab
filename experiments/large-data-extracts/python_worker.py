"""Un proceso por tarea; pandas sólo se importa al pedir ese motor."""
import csv
import json
import sys
from pathlib import Path
from common import PROJECT, cents, rows


def run(engine, task, source, encoding, output):
    header = next(rows(source, encoding))
    if len(header) != len(set(header)):
        raise ValueError('Cabeceras duplicadas: este comparador no puede mapearlas sin pérdida.')
    positions = {name: header.index(name) for name in PROJECT + ['estado']}
    count, groups = 0, {}
    destination = open(output, 'x', encoding=encoding, newline='') if task in ['T3', 'T5'] else None
    writer = csv.writer(destination) if destination else None
    if writer:
        writer.writerow(PROJECT if task == 'T3' else header)
    try:
        if engine == 'pandas':
            import pandas as pd
            chunks = pd.read_csv(source, dtype=str, keep_default_na=False, na_filter=False,
                                 encoding=encoding, encoding_errors='strict', skip_blank_lines=False,
                                 on_bad_lines='error', chunksize=50000)
            records = (list(row) for chunk in chunks for row in chunk.itertuples(index=False, name=None))
        else:
            records = rows(source, encoding)
            next(records)
        for row in records:
            def cell(name):
                pos = positions[name]
                return row[pos] if pos < len(row) else None
            match task:
                case 'T1':
                    count += 1
                case 'T2' | 'T3':
                    if cell('ciudad') == 'Oaxaca' and cell('estado') == 'entregado':
                        count += 1
                        if writer:
                            if any(positions[name] >= len(row) for name in PROJECT):
                                raise ValueError('La proyección incluiría un campo ausente; no rellenarlo silenciosamente.')
                            writer.writerow([cell(name) for name in PROJECT])
                case 'T4':
                    city = cell('ciudad')
                    item = groups.setdefault(city, [0, 0])
                    item[0] += 1
                    item[1] += cents(cell('total_mxn'))
                    count += 1
                case 'T5':
                    pos = positions['ciudad']
                    if pos < len(row):
                        row[pos] = row[pos].replace('Mérida', 'Merida')
                    writer.writerow(row)
                    count += 1
                case 'T6':
                    count += any('Primera línea' in value for value in row)
                case _:
                    raise ValueError(task)
    finally:
        if destination:
            destination.close()
    result = {'count': count}
    if task == 'T4':
        result['groups'] = [{'ciudad': city, 'count': values[0], 'sum_cents': str(values[1])}
                            for city, values in sorted(groups.items())]
    return result


if __name__ == '__main__':
    engine, task, source, encoding, output = sys.argv[1:]
    if output != '-':
        if Path(source).resolve() == Path(output).resolve():
            raise ValueError('El original es de solo lectura.')
    print(json.dumps(run(engine, task, source, encoding, output), ensure_ascii=False))
