// Run only inside an exclusive measurement window; all generated source data remains outside the repository.
import {mkdir,open,writeFile,chmod} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
const folder=resolve(process.argv[2],'fixtures');await mkdir(folder,{recursive:true});const metadata=[]
for(const [name,header,record,count] of [['regex-hostile-1GiB.csv','id,text\n','1,'+'a'.repeat(65535)+'!\n',16384],['ten-million.csv','id,text\n','1,target\n',10000001]]){
 const path=resolve(folder,name),file=await open(path,'wx'),hash=createHash('sha256');let bytes=0
 try{const write=async text=>{const data=Buffer.from(text);hash.update(data);bytes+=data.length;await file.writeFile(data)};await write(header);for(let i=0;i<count;){const n=Math.min(Math.floor(1048576/record.length),count-i);await write(record.repeat(n));i+=n}}
 finally{await file.close()}
 await chmod(path,0o444);metadata.push({path,bytes,records:count,sha256:hash.digest('hex')})
}
await writeFile(resolve(folder,'metadata.json'),JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(metadata))
