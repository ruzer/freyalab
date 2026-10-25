"""M2: verifica con el oráculo de Python los archivos que dejó la batería (T3, T5 y ordenación) y los borra.
Uso: python3 verify_outputs.py <resultados.json> <m1-ventas.json> ..."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'large-data-extracts'))
from common import fidelity, file_hash, rows, value_hash  # noqa: E402
from probe_m1_resources import checksum_rows  # noqa: E402

report_path, oracle_path = Path(sys.argv[1]), Path(sys.argv[2])
report, oracle = json.loads(report_path.read_text()), json.loads(oracle_path.read_text())
by = {(r['file'], r['task']): r for r in oracle['results'] if r['engine'] == 'python'}
sources, cache = {}, {}
for entry in report.get('battery', []):
    out = entry.get('output')
    if not out or not Path(out).exists():
        continue
    name = entry['file']; source = Path('/private/tmp/FreyaLab-pruebas') / name
    if entry['task'] == 'T3':
        entry['verified'] = {'values_sha256_equal': value_hash(rows(Path(out), 'utf-8')) == by[(name, 'T3')]['values_sha256']}
    elif entry['task'] == 'T5':
        f = fidelity(source, Path(out), 'utf-8', 'utf-8')
        entry['verified'] = {'values_sha256_equal': value_hash(rows(Path(out), 'utf-8')) == by[(name, 'T5')]['values_sha256'], 'fidelity': f}
    elif entry['task'] == 'sort':
        cache.setdefault(name, checksum_rows(source))
        got = checksum_rows(Path(out))
        entry['verified'] = {'records': got['records'], 'sorted': got['sorted_by_fecha_pedido'], 'same_records_as_source': got['records'] == cache[name]['records'] and got['order_independent_hash'] == cache[name]['order_independent_hash']}
    Path(out).unlink()
    print(name, entry['task'], entry['verified'].get('values_sha256_equal', entry['verified'].get('same_records_as_source')), flush=True)
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
