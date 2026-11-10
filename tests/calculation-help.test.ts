import {expect,it} from 'vitest'
import {calculationExamples,calculationFunctionGroups} from '../src/shared/calculation-help'
import {sqlColumns} from '../src/shared/sql-helpers'

it('enumera sin duplicados las funciones que ya permitía H15-1',()=>{
 const functions=Object.values(calculationFunctionGroups).flat()
 const original='abs acos asin atan atan2 ceil ceiling cos exp floor ln log log10 mod pow power round sign sin sqrt tan trunc char_length character_length concat concat_ws contains ends_with instr left length lower ltrim replace reverse right rtrim starts_with strpos substr substring trim upper date_add date_diff date_part date_sub datediff day dayofmonth dayofweek dayofyear extract make_date month strftime week year cast try_cast coalesce if ifnull nullif greatest least try'.split(' ')
 expect(functions.sort()).toEqual(original.sort())
})

it('usa perfiles reales, preserva su escala y protege nombres de columna',()=>{
 const fields=sqlColumns(['ID','Precio "unitario"','Cantidad','Fecha','Nombre','Nombre'])
 const examples=calculationExamples(fields,{
  0:{kind:'identifier'},1:{kind:'number',decimalPlaces:2},2:{kind:'number',decimalPlaces:0},
  3:{kind:'date'},4:{kind:'text'},5:{kind:'category'},
 })
 expect(Object.fromEntries(examples.map(({id,recipe})=>[id,recipe?.expression]))).toEqual({
  multiply:'"Precio ""unitario""" * "Cantidad"',percentage:'"Precio ""unitario""" / "Cantidad" * 100',round:'round("Precio ""unitario""", 2)',
  year:'year("Fecha")',month:'month("Fecha")',join:`"Nombre" || ' ' || "Nombre_2"`,
  condition:`if("Precio ""unitario""" > 10, 'Mayorista', 'Minorista')`,fill:'coalesce("Precio ""unitario""", 0)',
 })
 expect(examples.find(example=>example.id==='multiply')?.recipe?.columns).toEqual([{index:1,read:'number',scale:2},{index:2,read:'number',scale:0}])
 expect(examples.find(example=>example.id==='year')?.recipe?.columns).toEqual([{index:3,read:'date'}])
 expect(examples.find(example=>example.id==='join')?.recipe?.columns).toEqual([{index:4,read:'text'},{index:5,read:'text'}])
})

it('nunca toma identificadores, datos mixtos o columnas sin perfil para completar los ejemplos',()=>{
 const fields=sqlColumns(['ID','Precio','Fecha irregular','Otro'])
 const examples=calculationExamples(fields,{0:{kind:'identifier'},1:{kind:'number',decimalPlaces:4},2:{kind:'mixed'},3:null})
 expect(examples.filter(example=>example.recipe).map(example=>example.id)).toEqual(['round','condition','fill'])
 expect(examples.find(example=>example.id==='year')).toMatchObject({reason:'date1',recipe:undefined})
})

it('usa la primera columna de fechas que identificó el perfil',()=>{
 const fields=sqlColumns(['Fecha con espacios','Fecha ISO'])
 const profiles={0:{kind:'date'},1:{kind:'date'}} as const
 expect(calculationExamples(fields,profiles).find(example=>example.id==='year')?.recipe?.expression).toBe('year("Fecha con espacios")')
})

it('localiza los resultados del ejemplo Condición en inglés',()=>{
 const example=calculationExamples(sqlColumns(['Price']),{0:{kind:'number'}},'en').find(value=>value.id==='condition')
 expect(example?.recipe?.expression).toBe(`if("Price" > 10, 'Wholesaler', 'Retailer')`)
})
