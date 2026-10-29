import {it,expect} from 'vitest'
import {viewRequest} from '../src/main/large-view-schema'
it('la búsqueda grande valida UUID, revisión, aguja y condiciones sin aceptar rutas ni SQL',()=>{
 const request={requestId:crypto.randomUUID(),revision:0,search:'x'}
 expect(viewRequest.safeParse(request).success).toBe(true)
 for(const patch of [{requestId:'1'},{revision:-1},{search:''},{search:'x'.repeat(1001)},{path:'/tmp/a.csv'},{sql:'select 1'},{conditions:[{column:0,op:'empty',sql:'select 1'}]},{conditions:[{column:0,op:'empty',path:'/tmp/a.csv'}]},{conditions:Array.from({length:21},()=>({column:0,op:'empty'}))}])expect(viewRequest.safeParse({...request,...patch}).success).toBe(false)
})
