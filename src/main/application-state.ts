import {z} from 'zod'
import {isApplicationCommand,type ApplicationMenuContext} from './application-menu'
import type {ApplicationUiState} from '../shared/application'

export const applicationUiStateSchema:z.ZodType<ApplicationUiState>=z.object({
 activeId:z.uuid().nullable(),mode:z.enum(['edit','split','preview']),focus:z.enum(['none','editor','field','grid','cell','sql']),locked:z.boolean(),
 canUndo:z.boolean().optional(),canRedo:z.boolean().optional(),canEdit:z.boolean().optional(),hasSelection:z.boolean().optional(),inCodeMirror:z.boolean().optional(),modal:z.boolean().optional(),csvView:z.enum(['table','text']).optional(),
}).strict()
export const applicationCommandSchema=z.object({id:z.string().refine(isApplicationCommand),argument:z.union([z.string(),z.number()]).optional()}).strict().refine(command=>{
 if(command.id==='window.document')return z.uuid().safeParse(command.argument).success
 if(command.id==='file.openRecent')return z.number().int().min(0).max(9).safeParse(command.argument).success
 return command.argument===undefined
})

export function menuFingerprint(context:ApplicationMenuContext):string{
 const {documents,...state}=context
 return JSON.stringify({...state,documents:documents.map(({id,name,kind,readonly,csvView})=>({id,name,kind,readonly,csvView}))})
}
