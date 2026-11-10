import {expect,type Page} from '@playwright/test'

export async function readTableRows(page:Page,limit:number):Promise<string[][]>{
 const [doc]=await page.evaluate(()=>window.freya.documents())
 const processing=page.locator('.csv-status').getByText('Procesando…',{exact:true})
 let result:string[][]=[]
 await expect.poll(async()=>{
  if(await processing.isVisible())return false
  const rows=await page.evaluate(async({id,limit})=>{
   try{return(await window.freya.tablePage(id,{offset:0,limit,requestId:987})).rows.map(row=>row.cells)}
   catch(error){
    if(error instanceof Error&&error.message==='Consulta cancelada por una solicitud más reciente.')return null
    throw error
   }
  },{id:doc.id,limit})
  if(rows===null)return false
  result=rows
  return true
 },{message:'Leer las filas cuando se estabilice la tabla'}).toBe(true)
 return result
}
