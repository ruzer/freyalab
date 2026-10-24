import csv
import random
import json
from pathlib import Path
from datetime import date, timedelta

ROOT = Path(__file__).resolve().parent
FIELDS = ['venta_id', 'cliente_id', 'cliente', 'correo', 'ciudad', 'codigo_postal', 'producto_id', 'producto', 'categoria', 'cantidad', 'precio_unitario_mxn', 'descuento_pct', 'subtotal_mxn', 'descuento_mxn', 'iva_mxn', 'total_mxn', 'fecha_pedido', 'fecha_envio', 'fecha_entrega', 'estado', 'notas']
PRODUCTS = [('Laptop', 'Electrónica', 1850000), ('Monitor', 'Electrónica', 420000), ('Teclado', 'Accesorios', 85000), ('Silla ergonómica', 'Muebles', 560000), ('Escritorio', 'Muebles', 720000)]
CITIES = [('Oaxaca', '68000'), ('Puebla', '72000'), ('Mérida', '97000'), ('Guadalajara', '44100')]
NOTES = ['', 'Entrega en recepción', 'Paquete con accesorios, revisar', 'Cliente solicita "factura"', 'Primera línea\nSegunda línea', 'Prueba UTF-8: áéíóú ñ ü']

def money(cents):
    return f'{cents // 100}.{cents % 100:02d}'

def generate(path, target, wide=False):
    rng = random.Random(20261023)
    fields = FIELDS + ([f'medicion_{i:03d}' for i in range(1, 130)] if wide else [])
    rows = 0
    with path.open('x', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(fields)
        while f.tell() < target:
            for _ in range(1000):
                rows += 1
                cid = rng.randrange(1, 10001)
                city, postal = CITIES[cid % len(CITIES)]
                pid = rng.randrange(len(PRODUCTS))
                product, category, price = PRODUCTS[pid]
                qty = rng.randrange(1, 21)
                pct = rng.choice([0, 0, 5, 10, 15, 20])
                subtotal = qty * price
                discount = (subtotal * pct + 50) // 100
                tax = ((subtotal - discount) * 16 + 50) // 100
                total = subtotal - discount + tax
                ordered = date(2023, 1, 1) + timedelta(days=rng.randrange(1000))
                shipped = ordered + timedelta(days=rng.randrange(1, 5))
                delivered = shipped + timedelta(days=rng.randrange(1, 8))
                row = [f'V-{rows:012d}', f'C-{cid:06d}', f'Cliente sintético {cid}', f'cliente{cid}@example.invalid', city, postal, f'P-{pid+1:04d}', product, category, qty, money(price), pct, money(subtotal), money(discount), money(tax), money(total), ordered.isoformat(), shipped.isoformat(), delivered.isoformat(), 'entregado', rng.choice(NOTES)]
                if wide:
                    row += ['' if rng.random() < .03 else f'{rng.uniform(-100, 100):.3f}' for _ in range(129)]
                writer.writerow(row)
    return rows

def cents(value):
    whole, fraction = value.split('.')
    return int(whole) * 100 + int(fraction)

def validate(path, expected, wide):
    count = 0
    with path.open(encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        assert len(reader.fieldnames) == (150 if wide else 21)
        for count, r in enumerate(reader, 1):
            assert None not in r and all(v is not None for v in r.values())
            assert r['venta_id'] == f'V-{count:012d}'
            cid = int(r['cliente_id'][2:])
            assert (r['ciudad'], r['codigo_postal']) == CITIES[cid % 4]
            assert r['cliente'] == f'Cliente sintético {cid}'
            assert r['correo'] == f'cliente{cid}@example.invalid'
            product, category, price = PRODUCTS[int(r['producto_id'][2:])-1]
            assert (r['producto'], r['categoria'], cents(r['precio_unitario_mxn'])) == (product, category, price)
            subtotal = int(r['cantidad']) * price
            discount = (subtotal * int(r['descuento_pct']) + 50) // 100
            tax = ((subtotal - discount) * 16 + 50) // 100
            assert [cents(r[k]) for k in ['subtotal_mxn', 'descuento_mxn', 'iva_mxn', 'total_mxn']] == [subtotal, discount, tax, subtotal-discount+tax]
            assert r['fecha_pedido'] < r['fecha_envio'] < r['fecha_entrega']
            if wide:
                assert all(v == '' or -100 <= float(v) <= 100 for k, v in r.items() if k.startswith('medicion_'))
    assert count == expected
    return count

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Reproduce los fixtures sintéticos recibidos en E0; no sobrescribe archivos.')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.resolve().is_relative_to(Path(__file__).resolve().parents[2]):
        raise SystemExit('Generar fuera del repositorio, en una carpeta nueva.')
    import shutil
    if shutil.disk_usage(args.output.parent).free < 3 * 1024**3:
        raise SystemExit('Se requieren 3 GiB libres para generar/verificar estos fixtures.')
    args.output.mkdir(parents=True, exist_ok=False)
    ROOT = args.output.resolve()
    results = []
    for name, mib, wide in [('ventas_10MiB.csv', 10, False), ('ventas_100MiB.csv', 100, False), ('ventas_1GiB.csv', 1024, False), ('ancho_150_columnas_50MiB.csv', 50, True)]:
        path = ROOT / name
        rows = generate(path, mib * 1024**2, wide)
        validate(path, rows, wide)
        result = dict(archivo=name, filas=rows, columnas=150 if wide else 21, bytes=path.stat().st_size, validacion='Todas las filas: estructura, referencias, importes y fechas correctos')
        results.append(result)
        print(json.dumps(result, ensure_ascii=False), flush=True)
    (ROOT / 'validacion.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
