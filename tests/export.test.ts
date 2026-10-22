import { describe,it,expect,vi } from 'vitest'
vi.mock('electron',()=>({BrowserWindow:class{},dialog:{},app:{}}))
import { cleanSVG,autonomousHTML,autonomousSVG } from '../src/main/export'
describe('exportaciones de contenido no confiable',()=>{
 it('elimina scripts y handlers del SVG preservando el diagrama',()=>{const svg=cleanSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script><text onclick="alert(1)">Freya</text><use href="https://example.com/track"/></svg>');expect(svg).not.toContain('<script');expect(svg).not.toContain('onclick');expect(svg).not.toContain('https://');expect(svg).toContain('Freya');expect(svg).toContain('viewBox')})
 it('HTML autónomo bloquea red y suprime scripts y objetos',async()=>{const result=await autonomousHTML('<h1>Freya</h1><script>alert(1)</script><object data="file:///etc/passwd"></object><img src="https://example.com/secret"><style>body{background:url(https://example.com/x)}</style>');expect(result).toContain("default-src 'none'");expect(result).not.toContain('<script');expect(result).not.toContain('<object');expect(result).not.toContain('https://');expect(result).toContain('<h1>Freya</h1>')})
 it('prepara SVG autónomo saneado y rechaza contenido sin raíz SVG',async()=>{const svg=await autonomousSVG('<svg xmlns="http://www.w3.org/2000/svg"><text onclick="alert(1)">Freya</text></svg>');expect(svg).toContain('<svg');expect(svg).toContain('Freya');expect(svg).not.toContain('onclick');await expect(autonomousSVG('<p>No es un SVG</p>')).rejects.toThrow('SVG válido')})
})
