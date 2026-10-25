"""M1: cancelación y recursos (memoria, disco temporal) de cada herramienta sobre un CSV grande.

Subcomandos:
  cancel  reescribe el archivo (T5) y lo interrumpe a 1 s con SIGTERM o SIGKILL al grupo de procesos; mide cuánto tarda en
          desaparecer el grupo, si queda algún proceso, y qué queda en disco (salida parcial, temporales).
  sort    ordena el archivo completo por `fecha_pedido` a un archivo nuevo; muestrea cada 0,25 s la suma de RSS del grupo y el
          tamaño de la carpeta temporal; corta la ejecución si el grupo supera el tope de memoria del ensayo.

Solo comparador de evaluación; escribe en una carpeta nueva fuera del repositorio y no toca la fuente.
"""
import argparse
import datetime
import json
import os
import platform
import shutil
import signal
import subprocess
import threading
import time
from pathlib import Path

from benchmark import HERE, duck_sql
from common import file_hash, rows, value_hash
from m1_engines import Unsupported, commands

MEMORY_GUARD_BYTES = 20 * 1024**3  # el ensayo corta si el grupo supera 20 GiB de RSS (equipo de 32 GiB)


def group_rss(pgid):
    out = subprocess.run(['ps', '-ax', '-o', 'pgid=,rss='], capture_output=True, text=True).stdout
    return sum(int(rss) * 1024 for line in out.splitlines() if (parts := line.split()) and parts[0] == str(pgid) for rss in parts[1:])


def folder_bytes(path):
    total = 0
    for base, _, files in os.walk(path):
        for name in files:
            try:
                total += os.lstat(os.path.join(base, name)).st_size  # lstat: un enlace simbólico no cuenta como copia
            except OSError:
                pass
    return total


def build(engine, task, source, output, scratch, args):
    """Comandos de cada motor para una tarea; reutiliza los de benchmark.py y m1_engines.py."""
    if engine == 'duckdb':
        return [[args.duckdb, '-no-init', '-batch', '-bail', '-json', ':memory:', '-c', duck_sql(task, source, 'utf-8', output, str(scratch))]], False
    if engine == 'node':
        return [[args.node, str(HERE / 'node_worker.mjs'), task, str(source), 'utf-8', str(output)]], False
    stages, _, to_file = commands(engine, task, source, output, args)
    return stages, to_file


def launch(stages, to_file, output, env=None):
    processes, previous = [], None
    sink = open(output, 'xb') if to_file else None
    for index, stage in enumerate(stages):
        last = index == len(stages) - 1
        processes.append(subprocess.Popen(stage, stdin=previous.stdout if previous else subprocess.DEVNULL,
                                          stdout=(sink if sink else subprocess.DEVNULL) if last else subprocess.PIPE,
                                          stderr=subprocess.DEVNULL, process_group=processes[0].pid if processes else 0, env=env))
        if previous:
            previous.stdout.close()
        previous = processes[-1]
    if sink:
        sink.close()
    return processes


def group_alive(pgid):
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def reap(processes):
    for p in processes:
        p.poll()


def cancel(args):
    report = {'schema': 1, 'kind': 'M1 cancelación', 'platform': platform.platform(), 'results': [],
              'consulted_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'cancel_after_seconds': args.after}
    source = args.source.resolve()
    before = file_hash(source)
    for engine in args.engines:
        for sig in (signal.SIGTERM, signal.SIGKILL):
            scratch = args.output / f'{engine}-{sig.name}-scratch'
            scratch.mkdir(parents=True)
            output = args.output / f'{engine}-{sig.name}.csv'
            try:
                stages, to_file = build(engine, 'T5', source, output, scratch, args)
            except Unsupported as error:
                report['results'].append({'engine': engine, 'signal': sig.name, 'status': 'unsupported', 'error': str(error)})
                continue
            processes = launch(stages, to_file, output)
            pgid = processes[0].pid
            time.sleep(args.after)
            reap(processes)
            running = group_alive(pgid) and any(p.returncode is None for p in processes)
            partial_before = output.stat().st_size if output.exists() else 0
            sent = time.perf_counter()
            if running:
                os.killpg(pgid, sig)
            deadline = sent + 10
            while time.perf_counter() < deadline:
                reap(processes)
                if all(p.returncode is not None for p in processes):
                    break
                time.sleep(0.002)
            latency = time.perf_counter() - sent
            reap(processes)
            escalated = False
            if any(p.returncode is None for p in processes):
                escalated = True
                os.killpg(pgid, signal.SIGKILL)
                for p in processes:
                    p.wait(timeout=10)
            time.sleep(0.2)
            leftover = group_alive(pgid)
            entry = {'engine': engine, 'signal': sig.name, 'running_at_cancel': running, 'seconds_until_group_gone': latency,
                     'needed_sigkill_after_10s': escalated, 'exit_codes': [p.returncode for p in processes],
                     'processes_left_in_group': leftover, 'partial_output_exists': output.exists(),
                     'partial_output_bytes': output.stat().st_size if output.exists() else 0, 'output_bytes_at_cancel': partial_before,
                     'scratch_bytes_left': folder_bytes(scratch), 'scratch_entries_left': sum(len(f) for _, _, f in os.walk(scratch))}
            report['results'].append(entry)
            print(json.dumps(entry, ensure_ascii=False), flush=True)
            output.unlink(missing_ok=True)
            shutil.rmtree(scratch, ignore_errors=True)
    report['source_unchanged'] = file_hash(source) == before
    (args.output / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def sort_command(engine, source, output, scratch, args):
    s, o = str(source), str(output)
    if engine == 'qsv-sort':
        return [[args.qsv, 'sort', '-s', 'fecha_pedido', '-o', o, s]], False, {}
    if engine.startswith(('qsv-extsort', 'qsvlite-extsort')):
        # El modo CSV de extsort exige un índice, y `qsv index` lo escribe JUNTO al archivo de entrada: se indexa un enlace simbólico
        # dentro de la carpeta temporal para no escribir nunca junto al original (ver sort()).
        binary = args.qsv if engine.startswith('qsv-') else args.qsvlite
        limit = ['--memory-limit', '256'] if engine.endswith('256mb') else []
        return [[binary, 'extsort', '--select', 'fecha_pedido', '--tmp-dir', str(scratch), *limit, str(scratch / 'entrada.csv'), o]], False, {}
    if engine == 'miller':
        return [[args.miller, '-S', '--csv', 'sort', '-f', 'fecha_pedido', s]], True, {}
    if engine == 'polars':
        code = ("import polars as pl,sys;pl.scan_csv(sys.argv[1],infer_schema=False,encoding='utf8')"
                ".sort('fecha_pedido').sink_csv(sys.argv[2],line_terminator='\\r\\n',engine='streaming')")
        return [[args.polars_python, '-I', '-c', code, s, o]], False, {'POLARS_TEMP_DIR': str(scratch)}
    if engine == 'polars-node':
        code = ("const {createRequire}=require('node:module');const pl=createRequire(process.argv[1]+'/package.json')('nodejs-polars');"
                "pl.scanCSV(process.argv[2],{inferSchemaLength:0,encoding:'utf8'}).sort('fecha_pedido').sinkCSV(process.argv[3],{lineTerminator:'\\r\\n'}).collectSync()")
        return [[args.node, '-e', code, args.polars_node_dir, s, o]], False, {'POLARS_TEMP_DIR': str(scratch)}
    if engine in ('duckdb', 'duckdb-1gb'):
        sql = ("SET autoinstall_known_extensions=false; SET autoload_known_extensions=false; SET threads=4; SET memory_limit='" + ('1GB' if engine == 'duckdb-1gb' else '4GB') + "'; "
               f"SET temp_directory='{scratch}'; "
               f"COPY (SELECT * FROM read_csv('{s}', header=true, all_varchar=true, strict_mode=true) ORDER BY fecha_pedido) TO '{o}' (FORMAT CSV, HEADER);")
        return [[args.duckdb, '-no-init', '-batch', '-bail', ':memory:', '-c', sql]], False, {}
    raise ValueError(engine)


def checksum_rows(path):
    """Verificación fuera del cronómetro: nº de registros, orden por fecha y suma independiente del orden de los hashes."""
    import hashlib
    count, total, ordered, previous = 0, 0, True, ''
    iterator = rows(path, 'utf-8')
    header = next(iterator)
    key = header.index('fecha_pedido')
    for row in iterator:
        count += 1
        total = (total + int.from_bytes(hashlib.sha256('\x1f'.join(row).encode()).digest()[:8], 'big')) % 2**64
        if row[key] < previous:
            ordered = False
        previous = row[key]
    return {'records': count, 'order_independent_hash': total, 'sorted_by_fecha_pedido': ordered}


def sort(args):
    report = {'schema': 1, 'kind': 'M1 ordenación completa: memoria y disco temporal', 'platform': platform.platform(), 'results': [],
              'consulted_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'memory_guard_bytes': MEMORY_GUARD_BYTES,
              'method': 'ordenar el archivo por fecha_pedido a un archivo nuevo; RSS = suma del grupo de procesos muestreada cada 0,25 s (puede subestimar picos); disco = salida + carpeta temporal'}
    source = args.source.resolve()
    before = file_hash(source)
    expected = checksum_rows(source)
    report['source_records'] = expected
    for engine in args.engines:
        scratch = args.output / f'{engine}-scratch'
        scratch.mkdir(parents=True)
        output = args.output / f'{engine}.csv'
        index_info = {}
        if engine.startswith(('qsv-extsort', 'qsvlite-extsort')):
            (scratch / 'entrada.csv').symlink_to(source)
            started_index = time.perf_counter()
            subprocess.run([args.qsv if engine.startswith('qsv-') else args.qsvlite, 'index', str(scratch / 'entrada.csv')], check=True)
            index_info = {'index_seconds': time.perf_counter() - started_index, 'index_bytes': (scratch / 'entrada.csv.idx').stat().st_size,
                          'index_written_next_to': 'el enlace dentro de la carpeta temporal, no junto al original'}
        stages, to_file, env_extra = sort_command(engine, source, output, scratch, args)
        env = {**os.environ, **env_extra}
        peaks = {'rss': 0, 'scratch': 0, 'output': 0, 'disk': 0}
        stop = threading.Event()
        state = {'aborted': False}
        processes = launch(stages, to_file, output, env)
        pgid = processes[0].pid

        def sample():
            while not stop.is_set():
                rss = group_rss(pgid)
                tmp, out = folder_bytes(scratch), output.stat().st_size if output.exists() else 0
                peaks.update(rss=max(peaks['rss'], rss), scratch=max(peaks['scratch'], tmp), output=max(peaks['output'], out), disk=max(peaks['disk'], tmp + out))
                if rss > MEMORY_GUARD_BYTES:
                    state['aborted'] = True
                    os.killpg(pgid, signal.SIGKILL)
                    return
                stop.wait(0.25)
        watcher = threading.Thread(target=sample)
        watcher.start()
        started = time.perf_counter()
        status = 'measured'
        try:
            for p in processes:
                p.wait(timeout=args.timeout)
        except subprocess.TimeoutExpired:
            os.killpg(pgid, signal.SIGKILL)
            status = 'timeout'
        elapsed = time.perf_counter() - started
        stop.set()
        watcher.join()
        codes = [p.returncode for p in processes]
        entry = {'engine': engine, 'status': 'aborted_memory_guard' if state['aborted'] else status if not any(codes) else 'error',
                 'wall_seconds': elapsed, 'exit_codes': codes, 'peak_group_rss_bytes': peaks['rss'], 'peak_scratch_bytes': peaks['scratch'],
                 'peak_output_bytes': peaks['output'], 'peak_disk_bytes': peaks['disk'], 'source_bytes': source.stat().st_size, **index_info}
        if entry['status'] == 'measured' and output.exists():
            entry['verification'] = checksum_rows(output)
            entry['matches_source_records'] = (entry['verification']['records'] == expected['records']
                                               and entry['verification']['order_independent_hash'] == expected['order_independent_hash']
                                               and entry['verification']['sorted_by_fecha_pedido'])
        report['results'].append(entry)
        print(json.dumps(entry, ensure_ascii=False), flush=True)
        output.unlink(missing_ok=True)
        shutil.rmtree(scratch, ignore_errors=True)
        (args.output / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    report['source_unchanged'] = file_hash(source) == before
    (args.output / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['cancel', 'sort'])
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--engines', required=True)
    parser.add_argument('--after', type=float, default=1.0)
    parser.add_argument('--timeout', type=float, default=900)
    parser.add_argument('--node', required=True)
    parser.add_argument('--duckdb', default='/opt/homebrew/bin/duckdb')
    parser.add_argument('--qsv', required=True)
    parser.add_argument('--qsvlite', required=True)
    parser.add_argument('--miller', required=True)
    parser.add_argument('--polars-python', required=True)
    parser.add_argument('--polars-node-dir', required=True)
    args = parser.parse_args()
    if platform.system() != 'Darwin':
        raise SystemExit('Medido solo en macOS.')
    if args.output.resolve().is_relative_to(HERE.parents[1]) or args.output.resolve().is_relative_to(args.source.resolve().parent):
        raise SystemExit('La salida debe estar fuera del repositorio y de la carpeta de la fuente.')
    args.output.mkdir(parents=True, exist_ok=False)
    args.engines = args.engines.split(',')
    {'cancel': cancel, 'sort': sort}[args.mode](args)
