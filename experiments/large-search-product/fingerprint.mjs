import {createReadStream} from 'node:fs'
import {readFile,writeFile,stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
const folder=resolve(process.argv[2]),phase=process.argv[3],manifest=JSON.parse(await readFile(resolve(folder,process.argv[4]??'manifest.json'),'utf8')),fixtures=[]
for(const path of new Set(manifest.map(request=>request.path))){const info=await stat(path),hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);fixtures.push({path,size:info.size,mtimeMs:info.mtimeMs,ino:info.ino,sha256:hash.digest('hex')})}
await writeFile(resolve(folder,'fixtures-'+phase+'.json'),JSON.stringify(fixtures,null,2)+'\n');if(phase==='after')assert.deepEqual(fixtures,JSON.parse(await readFile(resolve(folder,'fixtures-before.json'),'utf8')));console.log(JSON.stringify(fixtures))
