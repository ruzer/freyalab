import { describe,it,expect,vi } from 'vitest'
vi.mock('electron',()=>({BrowserWindow:class{},dialog:{},app:{}}))
import { cleanSVG,autonomousHTML,autonomousSVG } from '../src/main/export'
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
