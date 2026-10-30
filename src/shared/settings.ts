import {z} from 'zod'

const sidebar=z.strictObject({visible:z.boolean(),ancho:z.number().min(180).max(420),pestana:z.enum(['files','outline'])})
const markdown=z.strictObject({modoInicial:z.enum(['edit','split','preview'])})
const version=z.string().regex(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/)
const updates=z.strictObject({buscarAlIniciar:z.boolean(),ultimaComprobacion:z.iso.datetime().nullable(),versionesOmitidas:z.array(version)})
const advanced=z.strictObject({herramientasDeDesarrollo:z.boolean()})
export const settingsSchema=z.strictObject({version:z.literal(1),idioma:z.enum(['sistema','es','en']),tema:z.enum(['system','light','dark']),barraLateral:sidebar,markdown,division:z.number().min(20).max(80),actualizaciones:updates,avanzado:advanced})
export const settingsPatchSchema=settingsSchema.omit({version:true}).partial().extend({barraLateral:sidebar.partial().optional(),markdown:markdown.partial().optional(),actualizaciones:updates.partial().optional(),avanzado:advanced.partial().optional()})
export type Settings=z.infer<typeof settingsSchema>
export type SettingsPatch=z.infer<typeof settingsPatchSchema>
export interface SettingsState {values:Settings;readonly:boolean;migrationPending:boolean;notice?:string}
export const legacySettingsInputSchema=z.strictObject({'freya-theme':z.string().optional(),'freya-sidebar':z.string().optional(),'freya-sidebar-width':z.string().optional(),'freya-sidebar-tab':z.string().optional(),'freya-split':z.string().optional()})
export const legacySettingsKeys=legacySettingsInputSchema.keyof().options
export type LegacySettings=z.infer<typeof legacySettingsInputSchema>

// Única tabla de valores iniciales; los demás consumidores reciben copias.
export function defaultSettings():Settings {
 return{version:1,idioma:'sistema',tema:'system',barraLateral:{visible:true,ancho:240,pestana:'files'},markdown:{modoInicial:'split'},division:50,actualizaciones:{buscarAlIniciar:false,ultimaComprobacion:null,versionesOmitidas:[]},avanzado:{herramientasDeDesarrollo:false}}
}
export function legacySettings(value:unknown):Settings {
 const result=defaultSettings(),source=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
 const theme=settingsSchema.shape.tema.safeParse(source['freya-theme'])
 if(theme.success)result.tema=theme.data
 if(source['freya-sidebar']==='true'||source['freya-sidebar']==='false')result.barraLateral.visible=source['freya-sidebar']==='true'
 const width=sidebar.shape.ancho.safeParse(typeof source['freya-sidebar-width']==='string'?Number(source['freya-sidebar-width']):undefined)
 if(width.success)result.barraLateral.ancho=width.data
 const tab=sidebar.shape.pestana.safeParse(source['freya-sidebar-tab'])
 if(tab.success)result.barraLateral.pestana=tab.data
 const split=settingsSchema.shape.division.safeParse(typeof source['freya-split']==='string'?Number(source['freya-split']):undefined)
 if(split.success)result.division=split.data
 return result
}
