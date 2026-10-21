import {describe,it,expect} from 'vitest'
import {markdownHTML,standaloneHTML} from '../src/renderer/lib/render'
describe('Markdown rendering',()=>{
 it('renders GFM without executing or preserving raw HTML',async()=>{const result=await markdownHTML('# Hola\n\n<script>alert(1)</script>\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n[mal](javascript:alert(1))');expect(result.html).toContain('<table>');expect(result.html).not.toContain('<script>');expect(result.html).not.toContain('href="javascript:');expect(result.headings).toEqual([{id:'heading-hola',text:'Hola',level:1}])})
 it('makes repeated heading anchors unique and retains diagram source',async()=>{const result=await markdownHTML('# Uno\n\n# Uno\n\n```mermaid\nflowchart LR\nA-->B\n```');expect(result.headings.map(h=>h.id)).toEqual(['heading-uno','heading-uno-1']);expect(result.html).toContain('language-mermaid');expect(result.html).toContain('A-->B')})
 it('renders formulas and produces a standalone document with escaped title',async()=>{const result=await markdownHTML('$x^2$');expect(result.html).toContain('class="katex"');const html=standaloneHTML(result.html,'<script>');expect(html).toContain('<title>&lt;script&gt;</title>');expect(html).toContain('@page');expect(html).not.toContain('cdn.')})
})
