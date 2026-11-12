const errorCodes=['changed','columns','value','cellsLimit','bytesLimit','recordLimit','undoLimit','encoding','disk'] as const
export type EmptyErrorCode=(typeof errorCodes)[number]
const prefix='[freya:EMPTY] '
export class EmptyError extends Error {
 constructor(code:EmptyErrorCode){super(prefix+JSON.stringify({code}))}
}
export function readEmptyError(error:unknown):{code:EmptyErrorCode}|undefined {
 const message=error instanceof Error?error.message:String(error),start=message.indexOf(prefix)
 if(start<0)return
 try{const info=JSON.parse(message.slice(start+prefix.length));if(info&&errorCodes.includes(info.code))return {code:info.code}}catch{return}
}
