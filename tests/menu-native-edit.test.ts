import {describe,expect,it} from 'vitest'
import {MenuNativeEdits,nativeEditArguments} from '../src/main/menu-native-edit'

describe('APP-01 M3/M5 · delegación nativa ligada al comando',()=>{
 it('consume una vez y conserva el verbo original aunque cambie el objeto del mensaje',()=>{
  const grants=new MenuNativeEdits(),message={id:'edit.copy'},nonce=grants.issue(7,message.id,true)!
  message.id='edit.paste'
  expect(grants.take(7,nonce)).toBe('copy');expect(grants.take(7,nonce)).toBeUndefined()
 })
 it('otro webContents no puede consumir ni anular la orden del dueño',()=>{
  const grants=new MenuNativeEdits(),nonce=grants.issue(7,'edit.cut',true)!
  expect(grants.take(8,nonce)).toBeUndefined();grants.finish(8,nonce)
  expect(grants.take(7,nonce)).toBe('cut')
 })
 it('finalizar el callback invalida su delegate sin ejecutarlo',()=>{
  const grants=new MenuNativeEdits(),nonce=grants.issue(7,'edit.paste',true)!
  grants.finish(7,nonce);expect(grants.take(7,nonce)).toBeUndefined()
 })
 it('cerrar una ventana limpia sólo las órdenes de sus webContents',()=>{
  const grants=new MenuNativeEdits(),first=grants.issue(7,'edit.copy',true)!,other=grants.issue(8,'edit.copy',true)!
  grants.clear(7);expect(grants.take(7,first)).toBeUndefined();expect(grants.take(8,other)).toBe('copy')
 })
 it.each(['edit.undo','edit.redo','edit.cut','edit.paste','edit.pastePlain'])('el foco readonly no recibe permiso para %s',id=>{
  expect(new MenuNativeEdits().issue(7,id,false)).toBeUndefined()
 })
 it.each(['edit.copy','edit.selectAll'])('readonly conserva %s',id=>{
  const grants=new MenuNativeEdits(),nonce=grants.issue(7,id,false)!
  expect(grants.take(7,nonce)).toBe(id==='edit.copy'?'copy':'selectAll')
 })
 it.each(['otro','executeJavaScript','toString','constructor'])('no crea una capacidad para %s',id=>{
  expect(new MenuNativeEdits().issue(7,id,true)).toBeUndefined()
 })
 it('acota las órdenes pendientes y mantiene distintas las válidas',()=>{
  const grants=new MenuNativeEdits(),nonces=Array.from({length:65},()=>grants.issue(7,'edit.copy',true)!)
  expect(new Set(nonces).size).toBe(65);expect(grants.take(7,nonces[0])).toBeUndefined();expect(grants.take(7,nonces.at(-1)!)).toBe('copy')
 })
 it('el mensaje sólo admite el nonce, sin verbo, texto ni ruta',()=>{
  const nonce='12345678-1234-4234-8234-123456789abc'
  expect(nativeEditArguments.parse([nonce])).toEqual([nonce])
  for(const args of [[nonce,'edit.paste'],[nonce,{text:'CANARIO'}],['/ruta'],[]])expect(nativeEditArguments.safeParse(args).success).toBe(false)
 })
})
