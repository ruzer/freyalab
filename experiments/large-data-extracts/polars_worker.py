"""M1: comparador Polars (Python). Se ejecuta con `python -I` desde un entorno externo; no es código de producto."""
import json
import sys

import polars as pl

task, source, output = sys.argv[1:]
PROJECT = ['venta_id', 'ciudad', 'producto', 'total_mxn']
# infer_schema=False: todas las columnas como texto (ceros a la izquierda, identificadores largos).
lazy = pl.scan_csv(source, infer_schema=False, has_header=True, encoding='utf8', quote_char='"')
where = (pl.col('ciudad') == 'Oaxaca') & (pl.col('estado') == 'entregado')
one = lambda frame: frame.select(pl.len()).collect(engine='streaming').item()
if task == 'T1':
    result = {'count': one(lazy)}
elif task == 'T2':
    result = {'count': one(lazy.filter(where))}
elif task == 'T3':
    lazy.filter(where).select(PROJECT).sink_csv(output, line_terminator='\r\n', engine='streaming')
    result = {}
elif task == 'T4':
    frame = (lazy.group_by('ciudad')
             .agg(pl.len().alias('count'), pl.col('total_mxn').str.replace('.', '', literal=True).cast(pl.Int64).sum().alias('s'))
             .sort('ciudad').collect(engine='streaming'))
    groups = [{'ciudad': r['ciudad'], 'count': r['count'], 'sum_cents': str(r['s'])} for r in frame.to_dicts()]
    result = {'count': sum(g['count'] for g in groups), 'groups': groups}
elif task == 'T5':
    lazy.with_columns(pl.col('ciudad').str.replace_all('Mérida', 'Merida', literal=True)).sink_csv(output, line_terminator='\r\n', engine='streaming')
    result = {}
elif task == 'T6':
    result = {'count': one(lazy.filter(pl.any_horizontal(pl.all().str.contains('Primera línea', literal=True))))}
else:
    raise ValueError(task)
print(json.dumps(result, ensure_ascii=False))
