// Persistencia de preferencias de espacio de trabajo con el patrón de ChartPresets: esquema versionado, Zod, escritura atómica y recuperación.
import { z } from 'zod'
import { mkdir, readFile, rename, writeFile, copyFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
const tab = z.enum(['resumen', 'graficos', 'sql'])
export const layout = z.object({
  version: z.literal(1),
  dock: z.object({ visible: z.boolean(), width: z.number().int().min(280).max(1200), tab }).strict(),
  panel: z.object({ width: z.number().int().min(360).max(4000), height: z.number().int().min(300).max(4000), x: z.number().int().min(-20000).max(20000).optional(), y: z.number().int().min(-20000).max(20000).optional(), tab }).strict()
}).strict()
export const defaults = () => ({ version: 1, dock: { visible: false, width: 480, tab: 'graficos' }, panel: { width: 640, height: 720, tab: 'graficos' } })
export async function load(path) {
  let raw
  try { raw = await readFile(path, 'utf8') } catch (error) { if (error.code === 'ENOENT') return { layout: defaults(), recovered: false } ; throw error }
  try { return { layout: layout.parse(JSON.parse(raw)), recovered: false } }
  catch { await copyFile(path, `${path}.invalid`).catch(() => {}); return { layout: defaults(), recovered: true } } // se conserva el original ilegible
}
export async function save(path, value) {
  const parsed = layout.parse(value); await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(parsed), 'utf8'); await rename(temp, path)
}
// Coloca una ventana guardada dentro de alguna pantalla visible (un monitor puede haber desaparecido).
export function fitBounds(saved, displays) {
  const area = displays[0].workArea
  const width = Math.min(saved.width, area.width), height = Math.min(saved.height, area.height)
  const visible = saved.x !== undefined && saved.y !== undefined && displays.some(d => { const a = d.workArea; const ox = Math.min(saved.x + width, a.x + a.width) - Math.max(saved.x, a.x), oy = Math.min(saved.y + height, a.y + a.height) - Math.max(saved.y, a.y); return ox >= Math.min(120, width) && oy >= Math.min(60, height) })
  return visible ? { x: saved.x, y: saved.y, width, height } : { x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2), width, height }
}
