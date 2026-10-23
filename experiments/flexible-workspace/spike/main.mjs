// Spike aislado del espacio de trabajo flexible: NO forma parte del producto y no importa nada de src/.
// Comprueba ventana secundaria, IPC validado, cola de consultas, cancelación, cierre y fallo del renderer.
import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { randomUUID, createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { V, CodedError, envelope, ops, event as eventSchema, view as viewSchema, response } from './contract.mjs'
import { JobQueue } from './queue.mjs'
import * as layoutStore from './layout-store.mjs'
const here = dirname(fileURLToPath(import.meta.url))
const cities = ['Mérida', 'Puebla', 'Monterrey', 'Guadalajara', 'CDMX'], products = ['Cuaderno', 'Mochila', 'Lápiz', 'Tablet']
const makeDoc = (name, n) => ({ id: randomUUID(), name, revision: 1, viewSeq: 0, dirty: false, view: viewSchema.parse({}), rows: Array.from({ length: n }, (_, i) => [cities[i % 5], products[i % 4], String(10 + (i % 90))]) })
const docs = new Map(); for (const d of [makeDoc('ventas.csv', 600), makeDoc('clientes.csv', 300)]) docs.set(d.id, d)
const panels = new Map() // webContents.id → entrada
const owners = new Map() // requestId → windowId
const counters = { crashes: 0, rejected: 0, byCode: {} }
let mainWin, closePending = false, quitting = false, activeDoc = [...docs.keys()][0]
const MAX_RESTARTS = 3, RESTART_WINDOW_MS = 60_000 // valores de prueba del spike, no medidos
const layoutPath = join(process.env.SPIKE_USER_DATA ?? app.getPath('userData'), 'workspace-layout.json')

// «Motor» simulado: una ventana oculta por trabajo, como el SqlService actual; el coste se simula con un temporizador.
const engine = {
  create: () => new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } }),
  run: async (win, spec) => { const t = Date.now(); await win.loadURL('data:text/html,<title>engine</title>'); await win.webContents.executeJavaScript(`new Promise(r=>setTimeout(()=>r(0),${spec.cost}))`); return { rows: spec.compute(), engineMs: Date.now() - t } },
  destroy: win => { if (!win.isDestroyed()) win.destroy() }
}
const queue = new JobQueue({ engine, concurrency: 1 })

const ok = (requestId, data) => response.parse({ v: V, ok: true, ...requestId ? { requestId } : {}, data })
const fail = (code, message, requestId) => { counters.rejected++; counters.byCode[code] = (counters.byCode[code] ?? 0) + 1; return response.parse({ v: V, ok: false, ...requestId ? { requestId } : {}, error: { code, message } }) }
const send = (entry, evt) => { const parsed = eventSchema.parse({ v: V, seq: ++entry.seq, ...evt }); entry.log.push(parsed); if (entry.log.length > 200) entry.log.shift(); if (!entry.win.isDestroyed()) entry.win.webContents.send('panel:event', parsed) }
const shellSend = evt => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('shell:event', evt) }
const broadcast = (docId, make) => { for (const entry of panels.values()) if (entry.docId === docId) send(entry, make(entry)) }

function compute(doc, view, column) {
  const search = view.search.toLowerCase()
  const rows = doc.rows.filter(r => (!search || r.some(c => c.toLowerCase().includes(search))) && Object.entries(view.filters).every(([i, v]) => (r[Number(i)] ?? '').toLowerCase().includes(v.toLowerCase())))
  const groups = new Map(); for (const r of rows) groups.set(r[column] ?? '', (groups.get(r[column] ?? '') ?? 0) + 1)
  return [...groups].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([k, n]) => [k, n])
}

function createPanel(docId) {
  const doc = docs.get(docId); if (!doc) throw new CodedError('E_DOC_CLOSED', 'El documento ya no está disponible.')
  const saved = layoutStore.defaults().panel
  const area = screen.getPrimaryDisplay().workArea
  const bounds = layoutStore.fitBounds(saved, screen.getAllDisplays().map(d => ({ workArea: d.workArea })))
  void area
  const win = new BrowserWindow({ ...bounds, title: `Análisis — ${doc.name}`, show: true, webPreferences: { preload: join(here, 'preload-panel.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
  const entry = { windowId: win.webContents.id, win, docId, docName: doc.name, seq: 0, state: 'loading', log: [] }
  panels.set(entry.windowId, entry)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); win.webContents.on('will-navigate', e => e.preventDefault())
  win.webContents.on('did-finish-load', () => {
    send(entry, { type: 'state', state: 'loading', docName: entry.docName })
    const live = docs.get(entry.docId)
    if (!live) { entry.state = 'closed'; send(entry, { type: 'state', state: 'closed', docName: entry.docName }); return }
    entry.state = 'ready'; send(entry, { type: 'state', state: 'ready', docName: live.name, revision: live.revision }); send(entry, { type: 'view', viewSeq: live.viewSeq, view: live.view })
  })
  win.webContents.on('render-process-gone', () => {
    counters.crashes++
    const now = Date.now(); entry.crashLog = [...(entry.crashLog ?? []).filter(t => now - t < RESTART_WINDOW_MS), now]
    queue.cancelWhere(sub => sub.windowId === entry.windowId, 'E_RENDERER_GONE', 'La ventana de análisis se reinició. Los datos no se modificaron.')
    // Presupuesto de reinicios: un renderer que se cae en bucle no se recarga indefinidamente; queda en «error» hasta que el usuario decida.
    if (entry.crashLog.length > MAX_RESTARTS) { entry.state = 'error'; shellSend({ type: 'panel-error', windowId: entry.windowId, docId: entry.docId }); return }
    entry.state = 'crashed'
    setTimeout(() => { if (!win.isDestroyed()) win.webContents.reload() }, 100)
  })
  win.on('closed', () => { queue.cancelWhere(sub => sub.windowId === entry.windowId, 'E_CANCELLED', 'La ventana se cerró.'); panels.delete(entry.windowId); for (const [id, w] of owners) if (w === entry.windowId) owners.delete(id); shellSend({ type: 'panel-closed', windowId: entry.windowId, docId }) })
  void win.loadFile(join(here, 'panel.html'))
  return entry.windowId
}

async function handlePanelOp(event, raw) {
  const entry = panels.get(event.sender.id)
  if (!entry || event.senderFrame !== event.sender.mainFrame) return fail('E_SENDER', 'Origen no autorizado.')
  let env; try { env = envelope.parse(raw) } catch { return fail('E_SCHEMA', 'Mensaje no válido.') }
  if (env.windowId !== entry.windowId) return fail('E_WINDOW', 'Identidad de ventana no válida.', env.requestId)
  if (env.docId !== entry.docId) return fail('E_DOC', 'Documento no asociado a esta ventana.', env.requestId)
  let payload; try { payload = ops[env.op].parse(env.payload ?? {}) } catch { return fail('E_SCHEMA', 'Datos de operación no válidos.', env.requestId) }
  const doc = docs.get(entry.docId)
  switch (env.op) {
    case 'hello': return ok(undefined, { windowId: entry.windowId, docId: entry.docId, docName: entry.docName, state: entry.state, ...doc ? { revision: doc.revision, viewSeq: doc.viewSeq, view: doc.view } : {} })
    case 'getView': if (!doc) return fail('E_DOC_CLOSED', `«${entry.docName}» se cerró.`); return ok(undefined, { revision: doc.revision, viewSeq: doc.viewSeq, view: doc.view })
    case 'cancel': {
      const owner = owners.get(payload.requestId); if (owner === undefined) return ok(undefined, { cancelled: false })
      if (owner !== entry.windowId) return fail('E_OWNER', 'Solo la ventana que pidió la consulta puede cancelarla.')
      return ok(undefined, { cancelled: queue.cancel(payload.requestId) })
    }
    case 'reattach': shellSend({ type: 'reattach', docId: entry.docId }); setImmediate(() => entry.win.close()); return ok(undefined, { reattached: true })
    case 'close': setImmediate(() => entry.win.close()); return ok(undefined, { closing: true })
    case 'run': {
      if (!doc) return fail('E_DOC_CLOSED', `«${entry.docName}» se cerró.`, env.requestId)
      if (!env.requestId) return fail('E_SCHEMA', 'Falta el identificador de solicitud.')
      if (env.revision !== undefined && env.revision !== doc.revision) return fail('E_STALE', `El documento cambió a la revisión ${doc.revision}.`, env.requestId)
      if (owners.has(env.requestId)) return fail('E_SCHEMA', 'Identificador de solicitud reutilizado.', env.requestId)
      owners.set(env.requestId, entry.windowId)
      const snapshot = structuredClone(doc.view), viewSeq = doc.viewSeq, revision = doc.revision
      const key = createHash('sha1').update(JSON.stringify([doc.id, revision, snapshot, payload.kind, payload.column])).digest('hex')
      try {
        const result = await queue.submit({ requestId: env.requestId, windowId: entry.windowId, docId: doc.id, revision, key, priority: payload.priority, spec: { label: `${payload.priority}:${env.requestId.slice(0, 4)}`, cost: payload.simulatedCostMs, compute: () => compute(doc, snapshot, payload.column) } }, p => { if (panels.has(entry.windowId)) send(entry, { type: 'progress', requestId: env.requestId, ...p, position: p.position < 0 ? undefined : p.position }) })
        return ok(env.requestId, { ...result, revision, viewSeq })
      } catch (error) { return fail(error.code ?? 'E_INTERNAL', error.message, env.requestId) }
      finally { owners.delete(env.requestId) }
    }
  }
}
ipcMain.on('panel:whoami', e => { const entry = panels.get(e.sender.id); e.returnValue = entry ? { windowId: entry.windowId, docId: entry.docId } : null })
ipcMain.handle('panel:op', (e, raw) => handlePanelOp(e, raw))

const assertShell = e => { if (!mainWin || e.sender !== mainWin.webContents) throw new Error('Origen no autorizado.') }
function stats() {
  const { order, ...q } = queue.stats
  return { queue: q, order, panels: [...panels.values()].map(p => ({ windowId: p.windowId, docId: p.docId, docResolved: docs.has(p.docId), docName: p.docName, state: p.state, seq: p.seq })), docs: [...docs.values()].map(d => ({ id: d.id, name: d.name, revision: d.revision, viewSeq: d.viewSeq, dirty: d.dirty, checksum: createHash('sha1').update(JSON.stringify(d.rows)).digest('hex') })), counters, closePending, windows: BrowserWindow.getAllWindows().length, activeDoc, layoutPath, owners: owners.size }
}
ipcMain.handle('shell:op', async (e, op, a, b) => {
  assertShell(e)
  switch (op) {
    case 'state': return stats()
    case 'activate': activeDoc = z.uuid().parse(a); return true
    case 'setView': { const doc = docs.get(z.uuid().parse(a)); if (!doc) throw new CodedError('E_DOC_CLOSED', 'Documento cerrado.'); doc.view = viewSchema.parse(b); doc.viewSeq++; broadcast(doc.id, () => ({ type: 'view', viewSeq: doc.viewSeq, view: doc.view })); return doc.viewSeq }
    case 'editDoc': { const doc = docs.get(z.uuid().parse(a)); doc.revision++; doc.dirty = true; doc.rows = doc.rows.map(r => [...r]); doc.rows[0][2] = String(Number(doc.rows[0][2]) + 1); queue.invalidate(doc.id); queue.cancelWhere((_s, job) => job.docId === doc.id && job.revision < doc.revision, 'E_STALE', 'El documento cambió.'); for (const p of panels.values()) if (p.docId === doc.id) { p.state = 'stale'; send(p, { type: 'state', state: 'stale', docName: doc.name, revision: doc.revision }) } return doc.revision }
    case 'closeDoc': { const id = z.uuid().parse(a), doc = docs.get(id); if (!doc) return false; docs.delete(id); queue.invalidate(id); queue.cancelWhere((_s, job) => job.docId === id, 'E_DOC_CLOSED', `«${doc.name}» se cerró.`); for (const p of panels.values()) if (p.docId === id) { p.state = 'closed'; send(p, { type: 'state', state: 'closed', docName: doc.name }) } return true }
    case 'detach': return createPanel(z.uuid().parse(a))
    case 'crashPanel': { const p = panels.get(z.number().int().parse(a)); p.win.webContents.forcefullyCrashRenderer(); return true }
    case 'closePanel': { panels.get(z.number().int().parse(a))?.win.close(); return true }
    case 'rawPanelOp': return handlePanelOp(e, a) // prueba de remitente: la ventana principal no debe poder usar el canal del panel
    case 'resolveClose': { closePending = false; if (a === 'discard') await quit(); return true }
    case 'requestClose': mainWin.close(); return true
    case 'layout': { if (a === 'save') await layoutStore.save(layoutPath, b); return layoutStore.load(layoutPath) }
  }
  throw new Error('Operación no válida.')
})
async function quit() { quitting = true; for (const p of [...panels.values()]) p.win.destroy(); queue.cancelWhere(() => true, 'E_CANCELLED', 'La aplicación se cierra.'); if (mainWin && !mainWin.isDestroyed()) mainWin.destroy(); app.quit() }

app.whenReady().then(() => {
  mainWin = new BrowserWindow({ width: 900, height: 600, title: 'Spike — ventana principal', webPreferences: { preload: join(here, 'preload-shell.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
  mainWin.on('close', e => { if (quitting) return; e.preventDefault(); const dirty = [...docs.values()].filter(d => d.dirty); if (dirty.length) { closePending = true; shellSend({ type: 'confirm-close', docs: dirty.map(d => d.name) }) } else void quit() })
  void mainWin.loadFile(join(here, 'shell.html'))
})
app.on('window-all-closed', () => { if (!quitting) void quit() })
