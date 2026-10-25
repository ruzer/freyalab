"""M2: compara el archivo que copió FreyaLab con los registros originales que cumplen la condición (oráculo independiente: Python csv).
Uso: python3 verify_pattern.py <fuente.csv> <salida.csv> [resultados.json]"""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'large-data-extracts'))
from common import raw_records, file_hash  # noqa: E402

source, output = Path(sys.argv[1]), Path(sys.argv[2])
digest, count, header_seen = hashlib.sha256(), 0, False
city = state = None
for values, raw in raw_records(source, 'utf-8'):
    if not header_seen:
        city, state = values.index('ciudad'), values.index('estado')
        digest.update(raw); header_seen = True; continue
    if values[city] == 'Oaxaca' and values[state] == 'entregado':
        digest.update(raw); count += 1
verdict = {'expected_records': count, 'expected_sha256': digest.hexdigest(), 'output_sha256': file_hash(output), 'bytes_identical': digest.hexdigest() == file_hash(output)}
print(json.dumps(verdict))
if len(sys.argv) > 3:
    report = json.loads(Path(sys.argv[3]).read_text()); report['verification'] = verdict; Path(sys.argv[3]).write_text(json.dumps(report, indent=2) + '\n')
sys.exit(0 if verdict['bytes_identical'] else 2)
