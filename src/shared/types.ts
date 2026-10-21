export type Kind = 'markdown' | 'text' | 'mermaid' | 'csv'
export type Encoding = 'utf8' | 'utf16le' | 'win1252'
export interface DocumentInfo { id:string; name:string; path:string|null; kind:Kind; text?:string; dirty:boolean; readonly:boolean; warning?:string; revision:number; encoding:Encoding; delimiter:string; headers?:string[]; rowCount?:number }
export interface TreeEntry { name:string; path:string; directory:boolean }
export interface TableQuery { search?:string; filters?:Record<string,string>; sort?:{column:number; descending:boolean; numeric:boolean}; offset:number; limit:number; requestId:number }
export interface TableRow { id:string; cells:string[] }
export interface TablePage { rows:TableRow[]; total:number; matched:number; revision:number; requestId:number; sample:boolean }
export type TableEdit = {type:'cell'; rowId:string; column:number; value:string} | {type:'paste';rowId:string;column:number;values:string[][]} | {type:'insertRow';afterId?:string} | {type:'deleteRows';ids:string[]} | {type:'insertColumn';index:number;name:string} | {type:'deleteColumn';index:number} | {type:'header';index:number;name:string} | {type:'replace';find:string;replacement:string;column?:number}
export interface TableStats { cells:number; empty:number; unique:number; numeric:number; sum:number|null; min:number|null; max:number|null; average:number|null }
export interface TableOptions { encoding?:Encoding; delimiter?:string; header?:boolean }
export interface TableExport { scope:'all'|'filtered'|'selection'; query?:TableQuery; rowIds?:string[]; columns?:number[]; delimiter?:string }
export interface ExportRequest { format:'pdf'|'html'|'svg'|'png'|'csv'|'tsv'; html?:string; svg?:string; table?:TableExport }
export interface RecoveryEntry { id:string; name:string; savedAt:string }
export interface AppEvent { type:'opened'|'changed'|'external'|'error'; document?:DocumentInfo; id?:string; message?:string }
export interface FreyaAPI {
 open():Promise<DocumentInfo[]>; openPaths(paths:string[]):Promise<DocumentInfo[]>; newDocument(kind:Kind):Promise<DocumentInfo>; folder():Promise<string|null>; tree(path:string):Promise<TreeEntry[]>;
 update(id:string,text:string):Promise<DocumentInfo>; save(id:string,as?:boolean):Promise<DocumentInfo|null>; close(id:string):Promise<boolean>; reload(id:string):Promise<DocumentInfo>; documents():Promise<DocumentInfo[]>;
 tablePage(id:string,query:TableQuery):Promise<TablePage>; tableEdit(id:string,edit:TableEdit):Promise<DocumentInfo>; tableOptions(id:string,options:TableOptions):Promise<DocumentInfo>;
 undo(id:string,redo?:boolean):Promise<DocumentInfo>; stats(id:string,rows:string[],columns:number[]):Promise<TableStats>; tableMarkdown(id:string,options:TableExport):Promise<string>;
 export(id:string,request:ExportRequest):Promise<string|null>; image(id:string,src:string):Promise<string|null>; openLink(url:string):Promise<void>;
 recents():Promise<string[]>; recoveries():Promise<RecoveryEntry[]>; recover(id:string):Promise<DocumentInfo>; discardRecovery(id:string):Promise<void>;
 onEvent(callback:(event:AppEvent)=>void):()=>void; droppedPaths(files:File[]):string[]
}
