#!/usr/bin/env python3
"""Genera el DOCX interno propio. Sólo herramienta de desarrollo; sin runtime nuevo."""
from pathlib import Path
import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / 'src/main/docx-reference'
asset = root / 'src/main/docx-reference.docx'
parts = ('[Content_Types].xml', '_rels/.rels', 'word/document.xml',
         'word/_rels/document.xml.rels', 'word/styles.xml', 'word/settings.xml')
contents = {}
for name in sorted(parts):
    # El checkout Windows puede usar CRLF; el recurso siempre conserva LF.
    contents[name] = (source / name).read_text(encoding='utf-8').replace('\r\n', '\n').encode('utf-8')
    ET.fromstring(contents[name])
with zipfile.ZipFile(asset, 'w', compression=zipfile.ZIP_STORED, allowZip64=False) as doc:
    for name, content in contents.items():
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 28, 0, 0, 0))
        info.compress_type = zipfile.ZIP_STORED
        info.create_system = 0
        info.external_attr = 0x20
        doc.writestr(info, content)
manifest = {
    'authorship': 'Original FreyaLab OOXML and styles; project MIT license.',
    'compression': 'ZIP_STORED',
    'zipDate': '2026-10-28T00:00:00',
    'sha256': hashlib.sha256(asset.read_bytes()).hexdigest(),
    'parts': {name: hashlib.sha256(content).hexdigest() for name, content in contents.items()},
}
(source / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
print(manifest['sha256'])
