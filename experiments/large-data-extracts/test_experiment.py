import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path
from python_worker import run

spec = importlib.util.spec_from_file_location('common', Path(__file__).with_name('common.py'))
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)


class IntegrityTests(unittest.TestCase):
    def test_hash_preserves_arity_and_boundaries(self):
        cases = [[['a', 'b']], [['ab']], [['a', '']], [['a']], [['00123']], [['123']]]
        self.assertEqual(len({common.value_hash(iter(rows)) for rows in cases}), len(cases))

    def test_money_is_exact_beyond_javascript_integer(self):
        self.assertEqual(common.cents('9007199254740993.01'), 900719925474099301)
        self.assertEqual(common.cents('-0.01'), -1)
        self.assertEqual(common.cents('123456789012345678901234567890.12'), 12345678901234567890123456789012)
        for invalid in ['1.001', 'NaN', '1e3', '1,00', '']:
            with self.assertRaises(ValueError):
                common.cents(invalid)

    def test_raw_records_respect_multiline_and_bom(self):
        text = 'a,b\r\n"00123","Primera línea\nSegunda línea"\r\nx,\r\ny\r\n'
        with tempfile.TemporaryDirectory() as folder:
            for encoding in ['utf-8-sig', 'utf-16', 'cp1252']:
                path = Path(folder) / 'input.csv'
                path.write_bytes(text.encode(encoding))
                records = list(common.raw_records(path, encoding))
                self.assertEqual([r for r, _ in records], [['a', 'b'], ['00123', 'Primera línea\nSegunda línea'], ['x', ''], ['y']])
                raw_encoding = 'utf-16-le' if encoding == 'utf-16' else 'utf-8' if encoding == 'utf-8-sig' else encoding
                self.assertEqual(b''.join(raw for _, raw in records), text.encode(raw_encoding))

    def test_fidelity_compares_untouched_records_only(self):
        with tempfile.TemporaryDirectory() as folder:
            source, output = [Path(folder) / name for name in ['source.csv', 'output.csv']]
            source.write_bytes(b'ciudad,id\r\n"Oaxaca",00123\r\nM\xc3\xa9rida,9\r\n')
            output.write_bytes(b'ciudad,id\r\n"Oaxaca",00123\r\nMerida,9\r\n')
            result = common.fidelity(source, output, 'utf-8', 'utf-8')
            self.assertTrue(result['values_exact'])
            self.assertTrue(result['unchanged_records_byte_exact'])
            self.assertEqual(result['changed_records'], 1)
            output.write_bytes(b'ciudad,id\nOaxaca,00123\nMerida,9\n')
            result = common.fidelity(source, output, 'utf-8', 'utf-8')
            self.assertTrue(result['values_exact'])
            self.assertFalse(result['unchanged_records_byte_exact'])

    def test_fidelity_separates_line_endings_from_quoting(self):
        # M1: una herramienta que solo cambia CRLF a LF no es lo mismo que una que quita comillas.
        with tempfile.TemporaryDirectory() as folder:
            source, output = [Path(folder) / name for name in ['source.csv', 'output.csv']]
            source.write_bytes(b'ciudad,id\r\n"Oaxaca",00123\r\nM\xc3\xa9rida,9\r\n')
            output.write_bytes(b'ciudad,id\n"Oaxaca",00123\nMerida,9\n')
            result = common.fidelity(source, output, 'utf-8', 'utf-8')
            self.assertFalse(result['unchanged_records_byte_exact'])
            self.assertTrue(result['unchanged_records_byte_exact_ignoring_final_eol'])
            output.write_bytes(b'ciudad,id\nOaxaca,00123\nMerida,9\n')
            result = common.fidelity(source, output, 'utf-8', 'utf-8')
            self.assertFalse(result['unchanged_records_byte_exact'])
            self.assertFalse(result['unchanged_records_byte_exact_ignoring_final_eol'])

    def test_bom_is_checked_separately_from_records(self):
        with tempfile.TemporaryDirectory() as folder:
            source, output = [Path(folder) / name for name in ['source.csv', 'output.csv']]
            text = 'ciudad,id\r\nOaxaca,00123\r\n'
            source.write_bytes(text.encode('utf-8-sig'))
            output.write_bytes(text.encode('utf-8'))
            result = common.fidelity(source, output, 'utf-8-sig', 'utf-8')
            self.assertTrue(result['values_exact'])
            self.assertTrue(result['unchanged_records_byte_exact'])
            self.assertFalse(result['bom_preserved'])

    def test_malformed_quotes_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'bad.csv'
            path.write_text('a,b\n1,"unclosed\n', encoding='utf-8')
            with self.assertRaises(csv.Error):
                list(common.raw_records(path, 'utf-8'))

    def test_tasks_against_hand_calculated_fixture(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'source.csv'
            records = [['venta_id', 'ciudad', 'producto', 'total_mxn', 'estado', 'notas'],
                       ['00123', 'Oaxaca', 'A', '9007199254740993.01', 'entregado', 'Primera línea\nSegunda línea'],
                       ['900719925474099312345678', 'Mérida', 'B', '-0.01', 'entregado', ''],
                       ['000', 'Oaxaca', 'C', '2.00', 'pendiente', '']]
            with source.open('w', newline='', encoding='utf-8') as stream:
                csv.writer(stream).writerows(records)
            before = source.read_bytes()
            for task, count in [('T1', 3), ('T2', 1), ('T3', 1), ('T4', 3), ('T5', 3), ('T6', 1)]:
                output = Path(folder) / f'{task}.csv'
                result = run('python', task, source, 'utf-8', output)
                self.assertEqual(result['count'], count)
                if task == 'T4':
                    self.assertEqual(result['groups'], [{'ciudad': 'Mérida', 'count': 1, 'sum_cents': '-1'},
                                                        {'ciudad': 'Oaxaca', 'count': 2, 'sum_cents': '900719925474099501'}])
                if task == 'T3':
                    self.assertEqual(list(common.rows(output, 'utf-8')), [common.PROJECT, ['00123', 'Oaxaca', 'A', '9007199254740993.01']])
                if task == 'T5':
                    self.assertTrue(common.fidelity(source, output, 'utf-8', 'utf-8')['values_exact'])
            self.assertEqual(source.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
