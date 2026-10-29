import {expect,it} from 'vitest'
import {csvOpenError} from '../src/main/csv-open-error'
const messages=[
 {message:'CSV no válido: Quote Not Closed: the parsing is finished with an opening quote at line 4',line:4},
 {message:'CSV no válido: Invalid Opening Quote: a quote is found on field "Nombre" at line 2, value is "5"',line:2},
 {message:'CSV no válido: Invalid Closing Quote: got "d" at line 2 instead of delimiter',line:2},
 {message:'CSV no válido: Invalid Opening Quote on field "line 999" at line 2',line:2},
 {message:'CSV no válido: Invalid Opening Quote on field "at line 999" at line 2, value is "at line 888"',line:2},
 {message:'CSV no válido: at line 2 and at line 3',line:undefined},
 {message:'CSV no válido: Sin una ubicación disponible',line:undefined},
 {message:'CSV no válido: at line 0',line:undefined},
 {message:'CSV no válido: at line 9007199254740993',line:undefined}
]
it.each(messages)('mantiene el mensaje y extrae sólo la ubicación del motor ($line)',({message,line})=>{
 const failure=csvOpenError('/datos/archivo.csv',100,new Error(message));expect(failure).toEqual({path:'/datos/archivo.csv',name:'archivo.csv',message,byteLength:100,textAllowed:true,...(line?{reportedLine:line}:{})})
})
it.each(['Permiso denegado','ENOENT: no such file','Ocurrió un error','<script>throw 1</script>'])('un error ajeno no ofrece interpretar otro formato: %s',message=>expect(csvOpenError('/datos/archivo.csv',100,new Error(message))).toBeUndefined())
it('mantiene caracteres especiales como datos y bloquea texto por encima del límite',()=>{
 const message='CSV no válido: got "<img src=x onerror=alert(1)>" at line 2',failure=csvOpenError('/datos/archivo.csv',10*1024*1024+1,new Error(message));expect(failure?.message).toBe(message);expect(failure?.textAllowed).toBe(false);expect(failure?.reportedLine).toBe(2)
})
