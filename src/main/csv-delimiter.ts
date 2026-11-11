import {parse} from 'csv-parse/sync'
import {RECORD_DELIMITERS} from './large-table'

export function csvDelimiter(text:string,path:string):string{
 if(path.endsWith('.tsv'))return '\t'
 let best=',',width=1
 for(const delimiter of [',',';','\t','|']){
  try{
   const [first]=parse(text,{delimiter,bom:true,to:1,relax_column_count:true,record_delimiter:RECORD_DELIMITERS}) as string[][]
   if(first&&first.length>width){best=delimiter;width=first.length}
  }catch{}
 }
 return best
}
