import { describe,it,expect,vi } from 'vitest'
vi.mock('electron',()=>({BrowserWindow:class{},dialog:{},app:{}}))
import { cleanSVG,autonomousHTML,autonomousSVG } from '../src/main/export'
import {markdownHTML,standaloneHTML} from '../src/renderer/lib/render'
import {localAnchorStats} from './helpers/markdown-invariants'
import {readFile,readdir,writeFile} from 'node:fs/promises'
describe('exportaciones de contenido no confiable',()=>{
 it('elimina scripts y handlers del SVG preservando el diagrama',()=>{const svg=cleanSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script><text onclick="alert(1)">Freya</text><use href="https://example.com/track"/></svg>');expect(svg).not.toContain('<script');expect(svg).not.toContain('onclick');expect(svg).not.toContain('https://');expect(svg).toContain('Freya');expect(svg).toContain('viewBox')})
 it('HTML autónomo bloquea red y suprime scripts y objetos',async()=>{const result=await autonomousHTML('<h1>Freya</h1><script>alert(1)</script><object data="file:///etc/passwd"></object><img src="https://example.com/secret"><style>body{background:url(https://example.com/x)}</style>');expect(result).toContain("default-src 'none'");expect(result).not.toContain('<script');expect(result).not.toContain('<object');expect(result).not.toContain('https://');expect(result).toContain('<h1>Freya</h1>')})
 it('prepara SVG autónomo saneado y rechaza contenido sin raíz SVG',async()=>{const svg=await autonomousSVG('<svg xmlns="http://www.w3.org/2000/svg"><text onclick="alert(1)">Freya</text></svg>');expect(svg).toContain('<svg');expect(svg).toContain('Freya');expect(svg).not.toContain('onclick');await expect(autonomousSVG('<p>No es un SVG</p>')).rejects.toThrow('SVG válido')})
})
it('B conserva el marcado inerte de una sección faltante en HTML autónomo',async()=>{
 const result=await autonomousHTML('<span class="enlace-roto" data-seccion-faltante="ausente">texto</span>')
 expect(result).toContain('class="enlace-roto" data-seccion-faltante="ausente"');expect(result).not.toContain('href="#ausente"')
})
it('C conserva las etiquetas semánticas de notas en la frontera de exportación',async()=>{
 const html='<sup><a id="user-content-fnref-1" href="#user-content-fn-1" data-footnote-ref aria-describedby="user-content-footnote-label">1</a></sup><section data-footnotes><h2 id="user-content-footnote-label">Notas al pie</h2><ol><li id="user-content-fn-1">Nota <a href="#user-content-fnref-1" data-footnote-backref aria-label="Volver a la referencia 1">↩</a></li></ol></section>'
 const result=await autonomousHTML(html)
 expect(result).toContain('data-footnotes');expect(result).toContain('data-footnote-ref');expect(result).toContain('data-footnote-backref')
 expect(result).toContain('aria-describedby="user-content-footnote-label"')
})
it('D conserva details/summary seguros y el atributo open, sin atributos ejecutables',async()=>{
 const result=await autonomousHTML('<details open><summary>Más</summary><p>Interior</p></details><details onclick="x()"><summary onmouseover="x()">Cerrado</summary>Final</details>')
 expect(result).toContain('<details open><summary>Más</summary><p>Interior</p></details>')
 expect(result).toContain('<details><summary>Cerrado</summary>Final</details>');expect(result).not.toMatch(/onclick|onmouseover/)
})
it('D conserva en HTML autónomo todos los destinos internos del corpus',async()=>{
 const directory=new URL('./fixtures/markdown-corpus/',import.meta.url),report=[]
 for(const name of (await readdir(directory)).filter(name=>name.endsWith('.md')).sort()){
  const result=await markdownHTML(await readFile(new URL(name,directory),'utf8'))
  const html=await autonomousHTML(standaloneHTML(result.html,name)),stats=localAnchorStats(html)
  expect(stats.missing,name).toEqual([]);expect(stats.duplicates,name).toEqual([])
  report.push({file:name,ids:stats.ids.length,localHrefs:stats.targets.length,missing:stats.missing.length,duplicates:stats.duplicates.length})
 }
 if(process.env.FREYALAB_MD_EVIDENCE==='1')await writeFile('/private/tmp/md002-export-anchors.json',JSON.stringify(report,null,2))
})
it.each(['marker-end','clip-path','fill'])('conserva las referencias SVG internas %s al incrustar fuentes para exportar',async attribute=>{
 const html=await autonomousHTML(`<svg viewBox="0 0 100 100"><defs><marker id="punta"><path d="M0 0L10 5L0 10z"/></marker></defs><path d="M0 0L80 80" ${attribute}="url(#punta)"/></svg>`)
 expect(html).toContain(`${attribute}="url(#punta)"`)
 expect(html).not.toContain(`${attribute}="url('')"`)
})
