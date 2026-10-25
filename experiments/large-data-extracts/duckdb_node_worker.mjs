// M2: ejecuta el SQL del banco con @duckdb/node-api (binding nativo) para compararlo con la CLI de DuckDB, con la MISMA configuración.
// El paquete vive en una carpeta externa (variable DUCKDB_NODE_DIR); no es dependencia del repositorio. Solo comparador de evaluación.
import {createRequire} from 'node:module'
import {join} from 'node:path'
const duck = createRequire(join(process.env.DUCKDB_NODE_DIR, 'package.json'))('@duckdb/node-api')
const sql = process.argv[2]
const instance = await duck.DuckDBInstance.create(':memory:')
const connection = await instance.connect()
const statements = await connection.extractStatements(sql)
let last
for (let index = 0; index < statements.count; index++) last = await (await statements.prepare(index)).runAndReadAll()
// Como `duckdb -json`: solo las consultas con filas con nombre; COPY y SET no imprimen nada que use el banco.
if (last && last.columnNames().some(name => !/^(Count|Success)$/.test(name))) console.log(JSON.stringify(last.getRowObjects(), (key, value) => typeof value === 'bigint' ? (Number.isSafeInteger(Number(value)) ? Number(value) : String(value)) : value))
connection.closeSync()
instance.closeSync()
