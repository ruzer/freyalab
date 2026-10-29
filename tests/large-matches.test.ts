import {it,expect} from 'vitest'
import {MatchList} from '../src/main/large-matches'

it('conserva fila, posición y longitud sin el límite de 32 bits y pagina entre bloques',()=>{
 const list=new MatchList(()=>1e6,3),rows=[1,2,130,2**32+5,2**32+6,Number.MAX_SAFE_INTEGER-1]
 rows.forEach((row,i)=>expect(list.append(row,2**40+i*1024,1048576-i)).toBe(true))
 expect(list.page(1,4)).toEqual(rows.slice(1,5).map((row,i)=>({row,position:2**40+(i+1)*1024,length:1048575-i})))
 expect(list.page(5,100)[0].row).toBe(rows[5]);expect(list.count).toBe(6)
})
it('respeta el presupuesto antes de reservar otro bloque sin perder lo encontrado',()=>{
 let budget=1000;const list:MatchList=new MatchList(()=>budget-list.bytes,2)
 expect(list.append(1,10,3)).toBe(true);expect(list.append(2,13,3)).toBe(true);budget=list.bytes;expect(list.append(3,16,3)).toBe(false)
 expect(list.bytes).toBe(budget);expect(list.page(0,10).map(entry=>entry.row)).toEqual([1,2])
})
it('recorta el extremo tardío sin perder deltas ni reservar un objeto por fila',()=>{
 const list=new MatchList(()=>1e6,3),rows=[1,2,130,2**32+5,2**32+6,Number.MAX_SAFE_INTEGER-1]
 rows.forEach((row,i)=>list.append(row,i*10,5));const before=list.bytes
 list.truncate(4);expect(list.count).toBe(4);expect(list.tailRow).toBe(rows[3]);expect(list.tailPosition).toBe(30);expect(list.tailLength).toBe(5)
 expect(list.page(0,20).map(row=>row.row)).toEqual(rows.slice(0,4));list.truncate(3);expect(list.bytes).toBeLessThan(before)
 expect(list.append(2**40,40,5)).toBe(true);expect(list.page(3,1)[0].row).toBe(2**40);list.truncate(0);expect(list.bytes).toBe(0);expect(list.count).toBe(0);expect(list.append(1,0,1)).toBe(true)
})
