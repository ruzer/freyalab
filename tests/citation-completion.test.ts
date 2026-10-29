import {it,expect,vi} from 'vitest'
import {EditorState} from '@codemirror/state'
import {markdown} from '@codemirror/lang-markdown'
import {ensureSyntaxTree} from '@codemirror/language'
import {CompletionContext} from '@codemirror/autocomplete'
import {completeCitations} from '../src/renderer/lib/citation-completion'
import type {BibliographyEntry} from '../src/shared/bibliography'
const entries:BibliographyEntry[]=[{id:'garcia2020',type:'book',title:'Una fuente local'}]
function context(text:string,readonly=false,position=text.length){const state=EditorState.create({doc:text,extensions:[markdown(),EditorState.readOnly.of(readonly)]});ensureSyntaxTree(state,state.doc.length,50);return new CompletionContext(state,position,false)}
it('ofrece claves después de [@ con título como ayuda',async()=>{
 const result=await completeCitations(context('Véase [@gar'),async()=>entries)
 expect(result?.from).toBe(8);expect(result?.options).toMatchObject([{label:'garcia2020',detail:'Una fuente local'}])
})
it.each(['correo@example.com','Texto sin una cita','\\[@gar','```md\n[@gar'])('no abre sugerencias en %s',async text=>{
 const load=vi.fn(async()=>entries)
 expect(await completeCitations(context(text),load)).toBeNull();expect(load).not.toHaveBeenCalled()
})
it('no completa dentro de código en línea reconocido por Markdown',async()=>{
 const load=vi.fn(async()=>entries)
 expect(await completeCitations(context('`[@gar`',false,6),load)).toBeNull();expect(load).not.toHaveBeenCalled()
})
it('solo lectura no consulta la biblioteca',async()=>{
 const load=vi.fn(async()=>entries);expect(await completeCitations(context('[@gar',true),load)).toBeNull();expect(load).not.toHaveBeenCalled()
})
it('una solicitud cancelada no devuelve opciones viejas',async()=>{
 const current=context('[@gar');Object.defineProperty(current,'aborted',{value:true})
 expect(await completeCitations(current,async()=>entries)).toBeNull()
})
it('un fallo de biblioteca conserva el texto y no rompe el editor',async()=>{
 const current=context('[@gar');expect(await completeCitations(current,async()=>{throw new Error('Biblioteca no disponible')})).toBeNull();expect(current.state.doc.toString()).toBe('[@gar')
})
