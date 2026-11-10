export interface ApplicationUiState {
 activeId:string|null;mode:'edit'|'split'|'preview';focus:'none'|'editor'|'field'|'grid'|'cell'|'sql';locked:boolean
 canUndo?:boolean;canRedo?:boolean;canEdit?:boolean;hasSelection?:boolean;inCodeMirror?:boolean;modal?:boolean;csvView?:'table'|'text'
}
export interface ApplicationCommand {id:string;argument?:string|number}
export interface ApplicationShortcut {id:string;label:string;accelerator:string|null;enabled:boolean}
export interface ApplicationShortcuts {platform:string;commands:ApplicationShortcut[]}

export function formatApplicationShortcut(accelerator:string,platform:string):string{
 const mac=platform==='darwin',tokens:Record<string,string>={CommandOrControl:mac?'⌘':'Ctrl',Command:mac?'⌘':'Cmd',Control:mac?'⌃':'Ctrl',Alt:mac?'⌥':'Alt',Shift:mac?'⇧':'Shift',Plus:'+'}
 return accelerator.split('+').map(token=>tokens[token]??token).join(mac?'':'+')
}

export const closePrepareCommand='app.prepareClose' as const
export const closeAbortCommand='app.closeAborted' as const
export interface ApplicationCloseHandlers {prepare:()=>Promise<boolean>;aborted:()=>void}
