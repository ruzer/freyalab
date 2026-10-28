export function invocationMessage(error:unknown):string {
 const message=error instanceof Error?error.message:String(error)
 return message.replace(/^Error invoking remote method 'freya':\s*(?:Error:\s*)?/,'')
}
