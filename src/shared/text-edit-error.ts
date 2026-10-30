// IPC y contextBridge recrean Error: el código viaja en el mensaje, no en propiedades adicionales.
const limitPrefix='[freya:TEXT_EDIT_LIMIT] '
export function textEditLimitError(message:string):Error {
 const error=new Error(message)
 error.message=limitPrefix+message
 return error
}
export function isTextEditLimitError(error:unknown):boolean {
 return(error instanceof Error?error.message:String(error)).startsWith(limitPrefix)
}
export function visibleEditError(message:string):string {
 return message.startsWith(limitPrefix)?message.slice(limitPrefix.length):message
}
