// Separar los sustitutos evita que dos casos contiguos formen un par válido.
const forbidden=[...Array.from({length:32},(_,code)=>code).filter(code=>![9,10,13].includes(code)),0xfffe,0xffff,...Array.from({length:2048},(_,index)=>0xd800+index)]
export const xmlControlBatches=Array.from({length:Math.ceil(forbidden.length/64)},(_,index)=>{
 const codes=forbidden.slice(index*64,(index+1)*64)
 return{label:codes.map(code=>code.toString(16).padStart(4,'0')).join(','),codes,value:'Antes '+codes.map(code=>String.fromCharCode(code)+'x').join('')+' Después ñ🐕',expected:'Antes '+' x'.repeat(codes.length)+' Después ñ🐕'}
})
