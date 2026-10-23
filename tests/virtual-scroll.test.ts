import {describe,expect,it} from 'vitest'
import {MAX_SCROLL_PX,scrollScale,scrollHeight,toLogical,toPhysical,rowTop} from '../src/renderer/lib/virtual-scroll'

const ROW=32,PADDING=40,VIEW=600
const total=(rows:number)=>PADDING+rows*ROW

describe('desplazamiento virtual: tablas que no caben en un elemento',()=>{
 it('Chromium no admite elementos más altos de 16 777 214 px: el tope queda por debajo con margen',()=>{
  expect(MAX_SCROLL_PX).toBeLessThan(16_777_214)
  expect(Math.floor((16_777_214-PADDING)/ROW)).toBe(524_286) // filas con las que se agota un elemento sin escalar
 })
 it('una tabla que cabe no cambia: escala 1 y misma altura',()=>{
  for(const rows of [0,1,100,100_000,Math.floor((MAX_SCROLL_PX-PADDING)/ROW)]){expect(scrollScale(total(rows),VIEW)).toBe(1);expect(scrollHeight(total(rows))).toBe(total(rows))}
 })
 it('una tabla que no cabe se escala y el elemento no supera el tope',()=>{
  for(const rows of [524_288,1_000_000,10_000_000,100_000_000]){
   expect(scrollScale(total(rows),VIEW)).toBeGreaterThan(1);expect(scrollHeight(total(rows))).toBe(MAX_SCROLL_PX)
  }
 })
 it('el final físico del recorrido es el final lógico: la última fila es alcanzable',()=>{
  for(const rows of [524_288,1_000_000,9_058_250,100_000_000]){
   const scale=scrollScale(total(rows),VIEW),maxPhysical=scrollHeight(total(rows))-VIEW,maxLogical=total(rows)-VIEW
   expect(toLogical(maxPhysical,scale)).toBeCloseTo(maxLogical,3)
   // con el desplazamiento máximo, la última fila queda dentro del contenido físico y a la vista
   const lastStart=PADDING+(rows-1)*ROW,top=rowTop(lastStart,maxLogical,scale)
   expect(top+ROW).toBeCloseTo(scrollHeight(total(rows)),3);expect(top).toBeGreaterThanOrEqual(maxPhysical-1e-6)
  }
 })
 it('al inicio, la primera fila está donde siempre',()=>{
  for(const rows of [1_000,1_000_000,50_000_000]){const scale=scrollScale(total(rows),VIEW);expect(rowTop(PADDING,0,scale)).toBe(PADDING)}
 })
 it('las filas vecinas conservan su separación real de 32 px en cualquier posición',()=>{
  const rows=9_058_250,scale=scrollScale(total(rows),VIEW)
  for(const logical of [0,12_345.5,1e6,1.5e8,total(rows)-VIEW]){
   const first=Math.floor((logical-PADDING)/ROW)
   for(let k=0;k<20;k++){
    const a=rowTop(PADDING+(first+k)*ROW,logical,scale),b=rowTop(PADDING+(first+k+1)*ROW,logical,scale)
    expect(b-a).toBeCloseTo(ROW,4)
   }
  }
 })
 it('ninguna fila dibujada cae fuera del contenido físico (ni pasa de 16,7 millones)',()=>{
  const rows=100_000_000,scale=scrollScale(total(rows),VIEW)
  for(const logical of [0,1e9,2.2e9,total(rows)-VIEW]){
   const first=Math.max(0,Math.floor((logical-PADDING)/ROW)-8)
   for(let k=0;k<30;k++){const top=rowTop(PADDING+(first+k)*ROW,logical,scale);expect(top).toBeLessThan(16_777_214);expect(top).toBeGreaterThan(-VIEW-ROW*20)}
  }
 })
 it('lógico y físico se corresponden en ambos sentidos',()=>{
  const scale=scrollScale(total(1_000_000),VIEW)
  for(const physical of [0,1,1234.5,4_999_999]){expect(toPhysical(toLogical(physical,scale),scale)).toBeCloseTo(physical,6)}
  expect(toLogical(100,1)).toBe(100)
 })
 it('sin medir el visor (alto 0) no se divide por cero',()=>{expect(Number.isFinite(scrollScale(total(5_000_000),0))).toBe(true);expect(scrollScale(total(5_000_000),0)).toBeGreaterThan(1)})
})
