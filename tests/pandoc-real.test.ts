import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {inflateRawSync} from 'node:zlib'
import {createServer,type Server} from 'node:http'
import {detectPandoc,pandocToDocx,testPandoc} from '../src/main/pandoc'

// El directorio central permite inspeccionar el DOCX sin herramientas del sistema ni dependencias.
function zipFiles(zip:Buffer):Map<string,Buffer> {
 const files=new Map<string,Buffer>()
 for(let offset=0;offset<zip.length-22;offset++){
  if(zip.readUInt32LE(offset)!==0x02014b50)continue
  const method=zip.readUInt16LE(offset+10),size=zip.readUInt32LE(offset+20),nameLength=zip.readUInt16LE(offset+28),extraLength=zip.readUInt16LE(offset+30),commentLength=zip.readUInt16LE(offset+32),local=zip.readUInt32LE(offset+42)
  const name=zip.subarray(offset+46,offset+46+nameLength).toString('utf8'),start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28),data=zip.subarray(start,start+size)
  files.set(name,method===8?inflateRawSync(data):data)
  offset+=45+nameLength+extraLength+commentLength
 }
 return files
}
const pandoc=await detectPandoc(process.env.FREYALAB_PANDOC_TEST_PATH)
const run=promisify(execFile)
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfGQAAAAASUVORK5CYII=','base64')
describe.skipIf(!pandoc.available)('AC-00 · P4 con Pandoc real',()=>{
 let folder:string,server:Server,port:number,hits=0
 const executable=pandoc.available?pandoc.path:''
 beforeAll(async()=>{
  folder=await mkdtemp(join(tmpdir(),'freyalab-ac00-'))
  for(const key of Object.keys(process.env))if(/^(?:https?|all)_proxy$/i.test(key))vi.stubEnv(key,'')
  server=createServer((_request,response)=>{hits++;response.writeHead(200,{'Content-Type':'image/png'});response.end(png)})
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  const address=server.address();if(!address||typeof address==='string')throw new Error('No se creó el servidor de prueba')
  port=address.port
  process.stdout.write(`AC-00 P4 real: ${process.platform}, ${JSON.stringify(pandoc)}\n`)
 })
 afterAll(async()=>{
  if(server?.listening)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
  if(folder)await rm(folder,{recursive:true,force:true})
  vi.unstubAllEnvs()
 })
 async function unsafe(source:string,args:string[]=[]):Promise<Buffer> {
  const child=execFile(executable,['-f','markdown','-t','docx',...args],{encoding:'buffer',timeout:10_000,maxBuffer:64*1024*1024})
  child.stdin?.end(source)
  return new Promise((resolve,reject)=>{const parts:Buffer[]=[];child.stdout?.on('data',chunk=>parts.push(chunk));child.on('error',reject);child.on('close',code=>code===0?resolve(Buffer.concat(parts)):reject(new Error(`Pandoc de control terminó con ${code}`)))})
 }
 it('Probar Pandoc produce un DOCX y conserva el texto UTF-8',async()=>{
  expect(await testPandoc(executable)).toMatchObject({ok:true,bytes:expect.any(Number)})
  const files=zipFiles(await pandocToDocx(executable,'# Informe\n\nAcentos: áéíóú, ñ y 中文.'))
  expect(files.get('word/document.xml')?.toString('utf8').replace(/<[^>]*>/g,'')).toContain('áéíóú, ñ y 中文')
 })
 it('hallazgo 1: el YAML no incorpora una bibliografía externa, ni con encabezados largos o YAML intermedio',async()=>{
  const secret=join(folder,'externa.bib')
  await writeFile(secret,'@book{canary, author={Autor Canario}, title={SECRETOBIBLIOGRAFICO}, year={2026}}')
  const yaml=`bibliography: ${JSON.stringify(secret)}\nnocite: '@*'`
  const control=zipFiles(await unsafe(`---\n${yaml}\n---\n# Informe`,['--sandbox','--citeproc']))
  expect(control.get('word/document.xml')?.toString()).toContain('SECRETOBIBLIOGRAFICO')
  for(const source of [`---\n${yaml}\n---\n# Informe`,`---\n${Array.from({length:110},(_,i)=>`key${i}: valor`).join('\n')}\n${yaml}\n---\n# Informe`,`# Informe\n\n---\n${yaml}\n---\n\nTexto`]){
   const files=zipFiles(await pandocToDocx(executable,source))
   expect(files.get('word/document.xml')?.toString()).not.toContain('SECRETOBIBLIOGRAFICO')
  }
 })
 it('hallazgo 2: raw OpenXML produce campos en el control, pero ninguno en la conversión protegida',async()=>{
  const source='```{=openxml}\n<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>INCLUDETEXT "file:///secreto.txt"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>\n```'
  expect(zipFiles(await unsafe(source,['--sandbox'])).get('word/document.xml')?.toString()).toMatch(/<w:(?:fldChar|instrText)/)
  expect(zipFiles(await pandocToDocx(executable,source)).get('word/document.xml')?.toString()).not.toMatch(/<w:(?:fldChar|instrText)/)
 })
 it('hallazgos 3/4: no incrusta imágenes por ruta, pero admite la imagen data ya autorizada',async()=>{
  const image=join(folder,'fuera con espacios.png');await writeFile(image,png)
  const control=zipFiles(await unsafe(`![externa](${image.replaceAll('\\','/')})`,['-f','markdown-raw_attribute-raw_html-raw_tex-yaml_metadata_block']))
  expect([...control.keys()].filter(path=>path.startsWith('word/media/'))).toHaveLength(1)
  const files=zipFiles(await pandocToDocx(executable,`![externa](${image.replaceAll('\\','/')})\n\n![interna](fuera.png)\n\n![autorizada](data:image/png;base64,${png.toString('base64')})`))
  expect([...files.keys()].filter(path=>path.startsWith('word/media/'))).toHaveLength(1)
  expect(files.get('word/_rels/document.xml.rels')?.toString()).not.toContain('fuera con espacios.png')
 })
 it('un documento no carga filtros nombrados en el YAML',async()=>{
  const filter=join(folder,'filtro.lua'),marker=join(folder,'filtro-ejecutado')
  await writeFile(filter,`local f = io.open(${JSON.stringify(marker.replaceAll('\\','/'))}, 'w'); f:write('EJECUTADO'); f:close()\nreturn {}`)
  const control=run(executable,['--lua-filter',filter,'-f','markdown','-t','plain'],{encoding:'utf8',timeout:10_000})
  control.child.stdin?.end('# Prueba');await control
  expect(await readFile(marker,'utf8')).toBe('EJECUTADO');await rm(marker)
  await pandocToDocx(executable,`---\nfilters: [${JSON.stringify(filter)}]\nlua-filter: ${JSON.stringify(filter)}\n---\n# Informe`)
  await expect(readFile(marker,'utf8')).rejects.toThrow()
 })
 it('un servidor local verificado recibe cero peticiones de la conversión protegida',async()=>{
  const source=`![remota](http://127.0.0.1:${port}/canary.png)`
  hits=0;const response=await fetch(`http://127.0.0.1:${port}/control.png`);await response.arrayBuffer();expect(hits).toBe(1)
  hits=0;const control=run(executable,['-f','markdown','-t','docx'],{encoding:'buffer',timeout:10_000})
  control.child.stdin?.end(source)
  const{stderr}=await control,hasHTTP=!stderr.toString().includes('compiled without HTTP support')
  expect(hits).toBe(hasHTTP?1:0)
  process.stdout.write(`AC-00 HTTP: ${hasHTTP?'control Pandoc con HTTP: 1 petición':'Pandoc sin soporte HTTP; eficacia del sandbox HTTP pendiente de otro binario'}\n`)
  hits=0;const files=zipFiles(await pandocToDocx(executable,source))
  expect(hits).toBe(0);expect([...files.keys()].filter(path=>path.startsWith('word/media/'))).toHaveLength(0)
 })
})
if(!pandoc.available)process.stdout.write(`AC-00 P4 OMITIDO (${process.platform}): ${pandoc.reason}\n`)
