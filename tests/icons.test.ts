import { describe, it, expect } from 'vitest'
import { icons, kindIcon, fileKind } from '../src/renderer/lib/icons'

describe('iconos', () => {
 it('cada icono es marcado SVG no vacío, sin scripts ni atributos de evento', () => {
  for (const [name, markup] of Object.entries(icons)) {
   expect(markup, name).toMatch(/^<(path|rect|circle|line|polyline|polygon|ellipse)\b/)
   expect(markup, name).not.toMatch(/<script|\son[a-z]+=|javascript:/i)
  }
 })
 it('el tipo de archivo sale del nombre y cada tipo tiene un icono existente', () => {
  expect(fileKind('ventas.CSV').kind).toBe('csv')
  expect(fileKind('datos.tsv').kind).toBe('csv')
  expect(fileKind('flujo.mmd').kind).toBe('mermaid')
  expect(fileKind('flujo.mermaid').kind).toBe('mermaid')
  expect(fileKind('guia.md').kind).toBe('markdown')
  expect(fileKind('notas.markdown').kind).toBe('markdown')
  expect(fileKind('leeme.txt').kind).toBe('text')
  expect(fileKind('sin-extension').kind).toBe('text')
  for (const icon of Object.values(kindIcon)) expect(icons[icon]).toBeTruthy()
  expect(fileKind('ventas.csv').icon).toBe(kindIcon.csv)
 })
})
