import {quoteIdentifier as q,sqlColumns} from './sql-helpers'
export interface SqlAssist {mode:'group'|'pivot'|'join';group:number;measure:number;category:number;values:string;aggregate:'count'|'sum'|'average';scale:number;leftKey:number;rightKey:number;leftJoin:boolean;otherTable:number}
export function assistedSQL(headers:string[],otherHeaders:string[],options:SqlAssist){
 const columns=sqlColumns(headers),other=sqlColumns(otherHeaders)
 const column=(index:number,list=columns)=>{const found=list[index];if(!found)throw new Error('Elige columnas válidas.');return q(found.name)}
 if(!Number.isInteger(options.scale)||options.scale<0||options.scale>12)throw new Error('Elige entre 0 y 12 decimales.')
 const numeric=()=>`TRY_CAST(NULLIF(TRIM(${column(options.measure)}), '') AS DECIMAL(38,${options.scale}))`
 if(options.mode==='join'){if(!Number.isInteger(options.otherTable)||options.otherTable<2||options.otherTable>4)throw new Error('Elige otro archivo abierto.');return `SELECT a.*, b.*\nFROM datos AS a\n${options.leftJoin?'LEFT':'INNER'} JOIN tabla_${options.otherTable} AS b\n  ON NULLIF(a.${column(options.leftKey)}, '') = NULLIF(b.${column(options.rightKey,other)}, '');`}
 const group=column(options.group)
 if(options.mode==='group'){const expression=options.aggregate==='count'?'':numeric();return options.aggregate==='count'?`SELECT ${group}, COUNT(*) AS "Filas"\nFROM datos\nGROUP BY ${group}\nORDER BY "Filas" DESC, ${group};`:`SELECT ${group}, COUNT(*) AS "Filas",\n  COUNT(${expression}) AS "Valores numéricos",\n  COUNT(*) - COUNT(${expression}) AS "Omitidos",\n  ${options.aggregate==='sum'?'SUM':'AVG'}(${expression}) AS "Resultado"\nFROM datos\nGROUP BY ${group}\nORDER BY ${group};`}
 const category=column(options.category),values=[...new Set(options.values.split('\n').filter(Boolean))];if(options.group===options.category)throw new Error('Filas y categorías necesitan columnas diferentes.');if(!values.length||values.length>20)throw new Error('Introduce entre 1 y 20 categorías, una por línea.')
 const literal=(text:string)=>"'"+text.replace(/'/g,"''")+"'"
 return `PIVOT (SELECT ${group}, ${category}${options.aggregate==='count'?'':`, ${numeric()} AS medida`} FROM datos)\nON ${category} IN (${values.map(literal).join(', ')})\nUSING ${options.aggregate==='count'?'COUNT(*)':options.aggregate==='sum'?'SUM(medida)':'AVG(medida)'}\nGROUP BY ${group}\nORDER BY ${group};`
}
