import {z} from 'zod'
import {filter} from './query-schema'
export const viewRequest=z.object({requestId:z.uuid(),revision:z.number().int().nonnegative(),search:z.string().min(1).max(1000).optional(),conditions:z.array(filter.strict()).max(20).optional(),filterMode:z.enum(['all','any']).optional()}).strict().refine(value=>!!value.search||!!value.conditions?.length,'Introduce una búsqueda o una condición.')
