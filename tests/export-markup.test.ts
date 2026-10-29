import {it,expect} from 'vitest'
import {cleanExportMarkup} from '../src/main/export-markup'
it('las imágenes del HTML usan sólo datos incrustados, como exige su CSP',()=>{
 const html=cleanExportMarkup('<img src="/private/tmp/secreto.png"><img src="https://example.com/x"><img src="../fuera.png"><img src="data:image/png;base64,aA==">')
 expect(html.match(/src=/g)).toHaveLength(1);expect(html).toContain('src="data:image/png;base64,aA=="')
})
it('tampoco conserva referencias externas de una imagen SVG embebida',()=>{
 const html=cleanExportMarkup('<svg><image href="/private/tmp/secreto.png"></image><image href="data:image/png;base64,aA=="></image></svg>')
 expect(html).not.toContain('/private/tmp/');expect(html).toContain('href="data:image/png;base64,aA=="')
})
it('conserva anclas y formato de citas sin ejecutar HTML del dato',()=>{
 const html=cleanExportMarkup('<a href="#ref-a"><em>García</em></a><p id="ref-a">Una fuente</p><script>CANARIO</script><img onerror="CANARIO">')
 expect(html).toContain('href="#ref-a"');expect(html).toContain('<em>García</em>');expect(html).toContain('id="ref-a"');expect(html).not.toMatch(/script|onerror|CANARIO/)
})
