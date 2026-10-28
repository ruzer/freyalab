import {describe,it,expect} from 'vitest'
import {visibleLiterals} from './helpers/i18n-audit'
describe('I18N-01 · guard AST de texto visible',()=>{
 it.each([
  ['<p>Guardar cambios</p>',['Guardar cambios']],
  ['<button aria-label="Abrir" title="Abrir archivo"></button>',['Abrir','Abrir archivo']],
  ['<button>{ready?"Guardar":"Cancelar"}</button>',['Guardar','Cancelar']],
  ['<p>{`Cerrar ${name}`}</p>',['Cerrar']],
  ['<script lang="ts">const label="Guardar"</script><p>{label}</p>',['Guardar']],
  ['<script lang="ts">let label=$state("Guardar")</script><p>{label}</p>',['Guardar']],
  ['<p>{t("dialog.save")}</p>',[]],
  ['<button id="guardar" class="dark" role="button" aria-controls="archivo"></button>',[]],
  ['<script lang="ts">const mode="dark",document="# Documento",unit="MiB"</script><span>20 px</span>',[]],
 ] as const)('%s',(source,expected)=>expect(visibleLiterals('component.svelte',source)).toEqual(expected))
 it.each([
  ["throw new Error('No se pudo abrir')",['No se pudo abrir']],
  ["dialog.showMessageBox({message:'¿Guardar?',buttons:['Guardar','Cancelar']})",['¿Guardar?','Guardar','Cancelar']],
  ["dialog.showMessageBox({message:t('dialog.close.message'),buttons:[t('dialog.save')]})",[]],
  ["const kind='csv',unit='MiB',source='# Hola';console.error('diagnóstico')",[]],
 ] as const)('%s',(source,expected)=>expect(visibleLiterals('module.ts',source)).toEqual(expected))
})
