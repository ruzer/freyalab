import {describe,it,expect} from 'vitest'
import {readFile} from 'node:fs/promises'
import {defaultKeymap,historyKeymap} from '@codemirror/commands'
import {searchKeymap} from '@codemirror/search'

describe('APP-01 M6 · comprobar los atajos de modo antes de adoptarlos',()=>{
 it('CodeMirror no asigna Mod-1, Mod-2 ni Mod-3 en sus mapas instalados',()=>{
  const keys=[...defaultKeymap,...historyKeymap,...searchKeymap].flatMap(binding=>[binding.key,binding.mac,binding.win,binding.linux]).filter(Boolean)
  expect(keys.filter(key=>/^(?:Mod|Cmd|Meta|Ctrl|Control)-[123]$/i.test(key!))).toEqual([])
 })
 it('la decisión conserva el atajo de Mermaid y deja libres los modos del menú',async()=>{
  const {applicationCommands}=await import('../src/main/application-menu')
  expect(applicationCommands.filter(command=>command.id.startsWith('view.mode.')).every(command=>!command.accelerator)).toBe(true)
  const diagram=await readFile('src/renderer/components/Diagram.svelte','utf8')
  expect(diagram).toMatch(/(?:event\.)?key\s*===?\s*['"]1['"]|\bDigit1\b|\b(?:Mod|Cmd|Meta|Ctrl|Control)[+-]1\b/)
 })
})
