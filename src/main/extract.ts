import {BrowserWindow, dialog} from 'electron'
import {basename, extname, join, resolve} from 'node:path'
import {lstat, realpath} from 'node:fs/promises'
import type {Documents} from './documents'
import {describeConditions} from '../shared/table-conditions'
import type {OperationOutcome, OperationRequest, ExtractResult} from '../shared/operations'

// E1 · Capa del proceso principal para las operaciones tipadas: elige y valida el destino (la interfaz nunca envía una ruta), delega el trabajo al
// motor de tablas y abre el archivo NUEVO. El original no se toca: ni se escribe ni se reabre.
async function destinationFor(sourceName: string) {
 const name = `${basename(sourceName, extname(sourceName))}.extracto${extname(sourceName).toLowerCase() === '.tsv' ? '.tsv' : '.csv'}`
 if (process.env.FREYALAB_TEST === '1' && (process.env.FREYALAB_TEST_EXTRACT_PATH || process.env.FREYALAB_TEST_EXTRACT_DIR)) return process.env.FREYALAB_TEST_EXTRACT_PATH ?? join(process.env.FREYALAB_TEST_EXTRACT_DIR!, name)
 const owner = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
 const result = await dialog.showSaveDialog(owner, {title: 'Guardar extracto', defaultPath: name, filters: [{name: 'CSV o TSV', extensions: ['csv', 'tsv']}]})
 return result.canceled ? null : result.filePath ?? null
}
async function validateDestination(docs: Documents, destination: string) {
 if ((await lstat(destination).catch(() => null))?.isSymbolicLink()) throw new Error('No se escribe sobre enlaces simbólicos.')
 if (!['.csv', '.tsv'].includes(extname(destination).toLowerCase())) throw new Error('El destino debe terminar en .csv o .tsv para poder abrirlo después.')
 const target = await realpath(destination).catch(() => resolve(destination))
 for (const r of docs.records.values()) if (r.info.path && target === (await realpath(r.info.path).catch(() => resolve(r.info.path!)))) throw new Error('El extracto debe ir a un archivo distinto de los que tienes abiertos: la extracción nunca modifica el original.')
}

export async function operateDocument(docs: Documents, id: string, request: OperationRequest): Promise<OperationOutcome> {
 const source = docs.get(id)
 if (source.info.kind !== 'csv' || !source.info.large) throw new Error('Esta operación solo se ofrece para archivos grandes (solo lectura).')
 if (request.operation !== 'filter_extract') return {result: await docs.table.call('operation', id, request)}
 const output = await destinationFor(source.info.name)
 if (!output) return null
 await validateDestination(docs, output)
 const result = await docs.table.call<ExtractResult>('operation', id, {...request, output})
 const document = await docs.open(output).catch(error => { throw new Error(`El extracto se guardó en ${output}, pero no se pudo abrir: ${(error as Error).message}`) })
 const record = docs.get(document.id)
 const headers = source.info.headers ?? []
 record.info.extract = {sourceName: source.info.name, sourcePath: source.info.path ?? '', matched: result.matched, total: result.scanned, conditions: request.conditions?.conditions.length ? describeConditions(headers, request.conditions) : null, columns: request.columns?.map(index => headers[index] ?? `Columna ${index + 1}`) ?? null, fidelity: result.fidelity, normalization: result.normalization, irregularRows: result.irregularRows}
 return {result, document: docs.info(document.id)}
}
