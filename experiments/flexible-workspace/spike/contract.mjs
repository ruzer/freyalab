// Contrato IPC de la ventana secundaria (propuesta). Todo mensaje se valida con Zod en main, en ambos sentidos.
import { z } from 'zod'
export const V = 1
export const codes = ['E_SENDER', 'E_SCHEMA', 'E_WINDOW', 'E_DOC', 'E_DOC_CLOSED', 'E_STALE', 'E_CANCELLED', 'E_OWNER', 'E_RENDERER_GONE', 'E_TIMEOUT', 'E_INTERNAL']
export class CodedError extends Error { constructor(code, message) { super(message); this.code = code } }
const uuid = z.uuid(), col = z.number().int().min(0).max(199)
export const priorities = ['interactive', 'export', 'background']
export const view = z.object({
  search: z.string().max(1000).default(''),
  filters: z.record(z.string().regex(/^\d{1,3}$/), z.string().max(1000)).default({}),
  order: z.array(z.object({ column: col, descending: z.boolean() }).strict()).max(8).default([])
}).strict()
// Operaciones que puede pedir una ventana secundaria. Cualquier otra se rechaza antes de tocar datos.
export const ops = {
  hello: z.object({}).strict(),
  getView: z.object({}).strict(),
  run: z.object({ kind: z.enum(['groupCount']), column: col, priority: z.enum(priorities).default('interactive'), simulatedCostMs: z.number().int().min(0).max(10000).default(0) }).strict(),
  cancel: z.object({ requestId: uuid }).strict(),
  reattach: z.object({}).strict(),
  close: z.object({}).strict()
}
export const envelope = z.object({
  v: z.literal(V), windowId: z.number().int().positive(), docId: uuid,
  requestId: uuid.optional(), revision: z.number().int().nonnegative().optional(),
  op: z.enum(Object.keys(ops)), payload: z.unknown().optional()
}).strict()
export const states = ['loading', 'ready', 'stale', 'closed', 'error', 'crashed']
// Eventos de main a la ventana: orden por `seq` (estrictamente creciente por ventana).
export const event = z.discriminatedUnion('type', [
  z.object({ v: z.literal(V), seq: z.number().int().positive(), type: z.literal('state'), state: z.enum(states), docName: z.string().max(200).optional(), revision: z.number().int().nonnegative().optional(), reason: z.string().max(300).optional() }).strict(),
  z.object({ v: z.literal(V), seq: z.number().int().positive(), type: z.literal('view'), viewSeq: z.number().int().nonnegative(), view }).strict(),
  z.object({ v: z.literal(V), seq: z.number().int().positive(), type: z.literal('progress'), requestId: uuid, phase: z.enum(['queued', 'running']), position: z.number().int().nonnegative().optional() }).strict()
])
export const response = z.union([
  z.object({ v: z.literal(V), ok: z.literal(true), requestId: uuid.optional(), data: z.unknown() }).strict(),
  z.object({ v: z.literal(V), ok: z.literal(false), requestId: uuid.optional(), error: z.object({ code: z.enum(codes), message: z.string().max(300) }).strict() }).strict()
])
