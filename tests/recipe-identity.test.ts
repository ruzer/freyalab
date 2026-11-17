import {it,expect} from 'vitest'
import {mkdtemp,writeFile,rename,utimes,rm,stat,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ProjectSourceRegistry} from '../src/main/project-source-registry'
import {prepareCsvSource,fingerprintCsvSource} from '../src/main/project-sources'
import type {ProjectStore} from '../src/main/projects'
import {runRecipe} from '../src/main/recipe-operation'
it('reemplazo entre quick y worker no debe aceptar otro inode en first parcial',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'recipe-identity-probe-'))
 try{
  const path=join(folder,'raw.csv'),replacement=join(folder,'replacement.csv')
  await writeFile(path,'ID,Value\n1,original\n2,restante\n3,restante\n');await utimes(path,1700000000,1700000000)
  const prepared=await prepareCsvSource(path,{header:true}),full=await fingerprintCsvSource(path),before=await stat(path)
  const source={id:'source',path:'raw.csv',external:false,protection:'readonly',...full,registeredAt:new Date().toISOString(),format:prepared.format,schema:{sha256:'0'.repeat(64),columns:prepared.columns}}
  const project={id:'project',path:await realpath(folder),readonly:false},store={active:project,sources:[source]}
  const registry=new ProjectSourceRegistry(store as unknown as ProjectStore,async()=>true,()=>{})
  const descriptor=await registry.recipeSource('project','source')
  await writeFile(replacement,'ID,Value\n1,changed!\n2,restante\n3,restante\n');await utimes(replacement,1700000000,1700000000);await rename(replacement,path)
  const after=await stat(path)
  expect(before.ino).not.toBe(after.ino);expect(before.size).toBe(after.size);expect(before.mtimeMs).toBe(after.mtimeMs)
  await expect(runRecipe(descriptor,[{op:'sample',method:'first',rows:1}])).rejects.toMatchObject({code:'changed'})
 }finally{await rm(folder,{recursive:true,force:true})}
})
