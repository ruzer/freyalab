import {expect,it} from 'vitest'
import {textEditLimitError,isTextEditLimitError,visibleEditError} from '../src/shared/text-edit-error'
const prefix='[freya:TEXT_EDIT_LIMIT] '
it.each(['El documento supera el límite de edición de 10 MiB.','Encoded buffer rejected.','[Tëxt ïnválïd~~~~]','<script> á ñ 🐕\nsegunda línea'])('el código único conserva el mensaje sin traducirlo: %s',message=>{
 const error=textEditLimitError(message);expect(error.message).toBe(prefix+message);expect(isTextEditLimitError(error)).toBe(true);expect(isTextEditLimitError(error.message)).toBe(true);expect(visibleEditError(error.message)).toBe(message)
})
it.each(['El documento supera el límite de edición de 10 MiB.','otro '+prefix+'fallo','[freya:OTHER] límite','[freya:TEXT_EDIT_LIMIT]sin espacio','','<script>','Error: Mensaje propio'])('no acepta códigos desconocidos ni cambia errores sin código: %s',message=>{
 expect(isTextEditLimitError(new Error(message))).toBe(false);expect(isTextEditLimitError(message)).toBe(false);expect(visibleEditError(message)).toBe(message)
})
it('no confunde un objeto ajeno con Error ni con un código del transporte',()=>{
 expect(isTextEditLimitError({message:prefix+'error'})).toBe(false);expect(isTextEditLimitError(undefined)).toBe(false);expect(isTextEditLimitError(null)).toBe(false)
})
