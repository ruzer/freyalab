import {z} from 'zod'
import {col,conditionGroup} from './query-schema'
import {PREVIEW_LIMIT} from '../shared/operations'

// Validación del contrato (src/shared/operations.ts) en la frontera de la IPC. `.strict()`: ningún campo desconocido, ni SQL ni ruta de salida.
const columns=z.array(col).min(1).max(1000).refine(list=>new Set(list).size===list.length,'Columnas repetidas')
const base={requestId:z.uuid(),source:z.object({revision:z.number().int().nonnegative()}).strict(),conditions:conditionGroup.optional(),search:z.string().min(1).max(1000).optional()}
export const operationRequest=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('count'),...base}).strict(),
 z.object({operation:z.literal('preview'),...base,columns:columns.optional(),limit:z.number().int().min(1).max(PREVIEW_LIMIT)}).strict(),
 z.object({operation:z.literal('filter_extract'),...base,columns:columns.optional()}).strict()
])
