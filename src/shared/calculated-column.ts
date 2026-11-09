import type {TableTransformPreview} from './types'

export interface ColumnRead {index:number;read:'text'|'number'|'date';scale?:number}
export interface CalculateColumnEdit {
 type:'structure'
 operation:'calculate'
 name:string
 position:number
 expression:string
 columns:ColumnRead[]
 onError:'empty'|'abort'
 revision:number
 requestId:string
}
export interface CalculatedValue {rowId:string;value:string|null;invalid:number[];failed:boolean}
export interface CalculatedColumnPreview extends Omit<TableTransformPreview,'samples'> {
 samples:{row:number;column:number;inputs:{column:number;value:string|null}[];after:string}[]
 emptyRows:number
 invalidByColumn:Record<number,number>
 failures:number
}

const errorCodes=['scalar','unknownColumn','textType','incompatible','tooLarge','rowTooShort','headerTooShort','failedRows','limitColumns','cellsLimit','bytesLimit','recordLimit','undoLimit','encoding','disk'] as const
export type CalculationErrorCode=(typeof errorCodes)[number]
interface CalculationErrorInfo {code:CalculationErrorCode;detail?:string;column?:string;row?:number}
const prefix='[freya:CALCULATE] '
export class CalculationError extends Error {
 constructor(code:CalculationErrorCode,detail?:string,column?:string,row?:number){
  // Electron recrea Error al cruzar IPC. Conserva los datos en el mensaje.
  super(prefix+JSON.stringify({code,detail:detail?.slice(0,16_000),column,row}))
 }
}
export function readCalculationError(error:unknown):CalculationErrorInfo|undefined{
 const message=error instanceof Error?error.message:String(error),start=message.indexOf(prefix)
 if(start<0)return
 try{
  const info=JSON.parse(message.slice(start+prefix.length)) as CalculationErrorInfo
  if(errorCodes.includes(info.code)&&(info.detail===undefined||typeof info.detail==='string')&&(info.column===undefined||typeof info.column==='string')&&(info.row===undefined||Number.isSafeInteger(info.row)))return info
 }catch{return}
}
