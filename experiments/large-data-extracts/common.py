"""Oráculo independiente: CSV de la biblioteca estándar, sin modelo del producto."""
import csv
import hashlib
import re
import struct
from decimal import Decimal, localcontext
from itertools import zip_longest

csv.field_size_limit(2 * 1024 * 1024)
PROJECT = ['venta_id', 'ciudad', 'producto', 'total_mxn']


def cents(value):
    # shortcut: fixture monetario con dos decimales; no es inferencia de tipos general.
    if not re.fullmatch(r'-?\d+\.\d{2}', value, flags=re.ASCII):
        raise ValueError(f'Importe fuera del contrato: {value!r}')
    with localcontext() as context:
        context.prec = max(28, len(value) + 2)
        return int(Decimal(value) * 100)


def raw_records(path, encoding):
    with open(path, encoding=encoding, newline='') as stream:
        lines = []

        def capture():
            for line in stream:
                lines.append(line)
                yield line

        raw_encoding = 'utf-16-le' if encoding == 'utf-16' else 'utf-8' if encoding == 'utf-8-sig' else encoding
        for row in csv.reader(capture(), strict=True):
            yield row, ''.join(lines).encode(raw_encoding)
            lines.clear()


def rows(path, encoding):
    with open(path, encoding=encoding, newline='') as stream:
        yield from csv.reader(stream, strict=True)


def value_hash(records):
    digest = hashlib.sha256()
    for row in records:
        digest.update(struct.pack('>Q', len(row)))
        for cell in row:
            raw = cell.encode('utf-8')
            digest.update(struct.pack('>Q', len(raw)))
            digest.update(raw)
    return digest.hexdigest()


def file_hash(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def _no_final_eol(raw):
    return raw[:-2] if raw.endswith(b'\r\n') else raw[:-1] if raw.endswith(b'\n') else raw


def fidelity(source, output, encoding, output_encoding):
    def bom(path):
        with open(path, 'rb') as stream:
            prefix = stream.read(3)
        return next((mark.hex() for mark in [b'\xef\xbb\xbf', b'\xff\xfe'] if prefix.startswith(mark)), '')
    source_bom, output_bom = bom(source), bom(output)
    original, transformed = raw_records(source, encoding), raw_records(output, output_encoding)
    header, header_raw = next(original)
    new_header, new_header_raw = next(transformed)
    city = header.index('ciudad')
    exact, raw_exact, changed, unchanged = header == new_header, header_raw == new_header_raw, 0, 1
    raw_exact_eol = _no_final_eol(header_raw) == _no_final_eol(new_header_raw)  # M1: separa el fin de línea del comillado
    old_hash, new_hash = hashlib.sha256(header_raw), hashlib.sha256(new_header_raw)
    for before, after in zip_longest(original, transformed):
        if before is None or after is None:
            exact = raw_exact = raw_exact_eol = False
            break
        values, raw = before
        out_values, out_raw = after
        expected = values.copy()
        if city < len(expected):
            expected[city] = expected[city].replace('Mérida', 'Merida')
        exact &= expected == out_values
        if expected == values:
            unchanged += 1
            raw_exact &= raw == out_raw
            raw_exact_eol &= _no_final_eol(raw) == _no_final_eol(out_raw)
            old_hash.update(raw)
            new_hash.update(out_raw)
        else:
            changed += 1
    return dict(values_exact=exact, unchanged_records_byte_exact=raw_exact,
                unchanged_records_byte_exact_ignoring_final_eol=raw_exact_eol,
                source_bom_hex=source_bom, output_bom_hex=output_bom, bom_preserved=source_bom == output_bom,
                unchanged_records_including_header=unchanged, changed_records=changed,
                unchanged_source_sha256=old_hash.hexdigest(), unchanged_output_sha256=new_hash.hexdigest())
