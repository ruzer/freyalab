import {expect,type Page} from '@playwright/test'
import type {TablePage,TableQuery} from '../../src/shared/types'

export async function readTablePage(page:Page,id:string,query:TableQuery):Promise<TablePage>{
 const processing=page.locator('.csv-status').getByText('Procesando…',{exact:true})
 let result:TablePage|undefined
 await expect.poll(async()=>{
  if(await processing.isVisible())return false
  const rows=await page.evaluate(async({id,query})=>{
   try{return await window.freya.tablePage(id,query)}
   catch(error){
    if(error instanceof Error&&error.message==='Consulta cancelada por una solicitud más reciente.')return null
    throw error
   }
  },{id,query})
  if(rows===null)return false
  result=rows
  return true
 },{message:'Leer las filas cuando se estabilice la tabla'}).toBe(true)
 return result!
}

export async function readTableRows(page:Page,limit:number):Promise<string[][]>{
 const [doc]=await page.evaluate(()=>window.freya.documents())
 return(await readTablePage(page,doc.id,{offset:0,limit,requestId:987})).rows.map(row=>row.cells)
}
