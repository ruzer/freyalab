<script lang="ts">
 import Icon from './Icon.svelte'
 import {createTable,tableFeatures} from '@tanstack/svelte-table'
 import {createVirtualizer,observeElementOffset} from '@tanstack/svelte-virtual'
 import {scrollScale,scrollHeight,toLogical,toPhysical,rowTop} from '../lib/virtual-scroll'
 import {get} from 'svelte/store'
 import {untrack,tick} from 'svelte'
 import CsvCommands,{type CsvCommand} from './CsvCommands.svelte'
 import CsvRangePreview from './CsvRangePreview.svelte'
 import CsvTransform from './CsvTransform.svelte'
 import CsvSql from './CsvSql.svelte'
 import CsvStatistics from './CsvStatistics.svelte'
 import CsvQueryTools from './CsvQueryTools.svelte'
 import CsvExtract from './CsvExtract.svelte'
 import {fidelityLabel} from '../../shared/operations'
 import AnalysisDock from './AnalysisDock.svelte'
 import {workspace,saveWorkspace,settleStartup} from '../lib/workspace.svelte'
 import {dockMode,isNarrow,type DockTab} from '../lib/workspace-layout'
 import {parse} from 'csv-parse/browser/esm/sync'
 import type {DocumentInfo,TablePage,TableQuery,TableEdit,TableExport,TableStats,Encoding,TableFilter,TableSort,TableRange,TableRangeEdit} from '../../shared/types'
 let {doc,onchange,onerror,onstatus,onreport}:{doc:DocumentInfo;onchange:(doc:DocumentInfo)=>void;onerror:(message:string)=>void;onstatus:(status:string)=>void;onreport:(markdown:string)=>Promise<void>}=$props()
 let showExtract=$state(false),extractButton=$state<HTMLButtonElement>()
 let showCommands=$state(false),commandsButton=$state<HTMLButtonElement>(),commandReturn:HTMLElement|null=null
 let showTransform=$state(false),transformStart=$state<import('../../shared/types').TableTransformEdit['operation']>()
 // Archivo grande (L2): solo lectura, páginas leídas del disco. Búsqueda, filtros, orden y estadísticas llegan en fases posteriores.
 const large=$derived(!!doc.large)
 let showGoto=$state(false),gotoValue=$state<number|null>(null),gotoError=$state(''),gotoInput=$state<HTMLInputElement>(),gotoButton=$state<HTMLButtonElement>()
 let bodyWidth=$state(0),userOpened=$state(false) // userOpened: el panel lo abrió la persona en este documento (no se restauró), para que Estadísticas pueda llevar el foco a su encabezado
 // El panel no se monta hasta medir el área: así un panel restaurado que va a empezar cerrado (ventana estrecha) nunca llega a montarse.
 const dockOpen=$derived(workspace.visible&&bodyWidth>0),dockTab=$derived(workspace.tab),mode=$derived(dockMode({visible:workspace.visible,expanded:workspace.expanded,area:bodyWidth})),narrow=$derived(isNarrow(bodyWidth))
 let announcement=$state('')
 $effect.pre(()=>{if(bodyWidth>0)untrack(()=>settleStartup(bodyWidth))})
 let analyzeButton=$state<HTMLButtonElement>()
 let interpreting=$state(false)
 function toggleDock(tab:DockTab){userOpened=true;if(workspace.visible&&workspace.tab===tab){workspace.visible=false;workspace.expanded=false}else{workspace.visible=true;workspace.tab=tab}saveWorkspace()}
 function closeDock(button?:HTMLButtonElement){workspace.visible=false;workspace.expanded=false;saveWorkspace();button?.focus()}
 function setExpanded(value:boolean){workspace.expanded=value;announcement=value?'Panel de análisis ampliado':'Panel de análisis acoplado'}
 // Con la ventana estrecha no hay sitio para acoplar: volver a la tabla es cerrar el panel.
 async function backToTable(){if(narrow){closeDock(analyzeButton);return}workspace.expanded=false;announcement='Vuelves a la tabla';await tick();scrollElement?.focus()}
 let conditions=$state<TableFilter[]>([]),order=$state<TableSort[]>([]),filterMode=$state<'all'|'any'>('all'),showQuery=$state(false),queryError=$state(''),queryButton=$state<HTMLElement>()
 const locked=$derived(doc.readonly||interpreting||!!queryError)
 let search=$state(''),filters=$state<Record<string,string>>({}),sort=$state<TableQuery['sort']>(),page=$state<TablePage>({rows:[],total:0,matched:0,revision:0,requestId:0,sample:false}),busy=$state(false),showFilters=$state(false),showReplace=$state(false)
 const activeOrder=$derived(order.length?order:sort?[sort]:[])
 const filterCount=$derived(Object.values(filters).filter(Boolean).length+conditions.length+(search?1:0)),viewActive=$derived(filterCount>0||activeOrder.length>0)
 let selectedRows=$state<string[]>([]),selectedColumns=$state<number[]>([]),selectionStats=$state<TableStats|null>(null)
 let searchInput=$state<HTMLInputElement>(),replaceInput=$state<HTMLInputElement>()
 let replaceFind=$state(''),replaceWith=$state(''),header=$state(true),numeric=$state(false)
 let scrollElement=$state<HTMLDivElement>(),pageOffset=$state(0),requestId=0
 let editing=$state<{rowId:string;column:number;value:string}|null>(null),editingHeader=$state<{index:number;value:string}|null>(null)
 type Cell={row:number;column:number}
 let selection=$state<{anchor:Cell;end:Cell;query:TableQuery;revision:number}|null>(null),dragging=$state(false),pendingCell=$state<Cell|null>(null)
 let rangeDialog=$state<{edit:TableRangeEdit;cut?:boolean;documentScope?:boolean;column?:{name:string;rows:number;hidden:number;title:string}}|null>(null),context=$state<{x:number;y:number;kind:'range'|'rows'|'columns';column?:number}|null>(null)
 let contextMenu=$state<HTMLDivElement>(),contextReturn:HTMLElement|null=null
 let dragPoint={x:0,y:0}
 const cellRange=$derived<TableRange|null>(selection?{top:Math.min(selection.anchor.row,selection.end.row),bottom:Math.max(selection.anchor.row,selection.end.row),left:Math.min(selection.anchor.column,selection.end.column),right:Math.max(selection.anchor.column,selection.end.column),query:selection.query,revision:selection.revision}:null)
 const rangeActions=[['copy','Copiar rango'],['cut','Cortar rango…'],['paste','Pegar en rango…'],['fill','Rellenar rango…'],['clear','Vaciar rango…'],['trim','Quitar espacios del rango…'],['upper','Mayúsculas en el rango…'],['lower','Minúsculas en el rango…'],['replace','Reemplazar en el rango…'],['transformations','Transformar documento…']] as const
 // Columna sobre la que actúan las acciones de limpieza: la del menú ▾ de su cabecera o, desde la paleta, la única columna marcada.
 const targetColumn=$derived(context?.kind==='columns'&&context.column!==undefined?context.column:selectedColumns.length===1?selectedColumns[0]:undefined)
 const columnLabel=(index:number)=>doc.headers?.[index]||`Columna ${index+1}`
 // La columna entera de la vista actual: el mismo rango que una selección de celdas, así la vista previa y el deshacer son los de siempre.
 const columnRange=(index:number):TableRange=>({top:0,bottom:Math.max(page.matched-1,0),left:index,right:index,query:$state.snapshot(pageQuery),revision:page.revision})
 function cleanColumn(operation:'upper'|'lower'|'trim'){
  const column=targetColumn;if(column===undefined||locked||busy||!page.matched)return
  context=null;pendingCell=null;selection=null
  const titles={upper:'Mayúsculas',lower:'Minúsculas',trim:'Quitar espacios'}
  rangeDialog={edit:{type:'range',range:columnRange(column),operation,value:'',find:''},column:{name:columnLabel(column),rows:page.matched,hidden:Math.max(page.total-page.matched,0),title:`${titles[operation]} en la columna «${columnLabel(column)}»`}}
 }
 async function filterColumn(){const column=targetColumn;if(column===undefined)return;context=null;showFilters=true;get(columnsVirtual).scrollToIndex(column);await tick();document.querySelector<HTMLInputElement>(`[data-column-filter="${column}"]`)?.focus()}
 function columnStatistics(){if(targetColumn===undefined)return;selectedColumns=[targetColumn];context=null;showQuery=false;userOpened=true;workspace.visible=true;workspace.tab='resumen';saveWorkspace()}
 const commands=$derived<CsvCommand[]>([
  {id:'goToRow',label:'Ir a la fila…',detail:'Salta a una fila por su número · Ctrl/⌘ + G',disabled:!page.matched,run:openGoto},
  {id:'search',label:'Buscar en tabla',detail:large?'Aún no disponible en archivos grandes':'Filtra filas · Ctrl/⌘ + F',disabled:large,run:()=>{searchInput?.focus();searchInput?.select()}},
  {id:'replaceDocument',label:'Reemplazar en documento…',detail:'Documento completo, incluidas filas ocultas · vista previa · Ctrl/⌘ + Mayús + F',disabled:large,run:focusReplace},
  {id:'filters',label:'Filtros por columna',detail:'Mostrar u ocultar filtros de texto en encabezados',disabled:large,run:()=>showFilters=!showFilters},
  {id:'query',label:'Consulta avanzada',detail:'Filtrar por texto, número, fecha o regex; ordenar varias columnas · solo vista',disabled:large,run:()=>showQuery=!showQuery},
  {id:'extract',label:'Extraer filas a un archivo nuevo…',detail:'Filtra por condiciones y columnas el archivo grande y crea un archivo nuevo; el original no se modifica',disabled:!large,run:()=>{showQuery=false;showExtract=!showExtract}},
  {id:'clearQuery',label:'Quitar filtros y orden',detail:'Restaura la vista de todas las filas; no cambia el documento',disabled:!search&&!Object.values(filters).some(Boolean)&&!sort&&!order.length&&!conditions.length,run:()=>{search='';filters={};sort=undefined;conditions=[];order=[];showQuery=false}},
  {id:'sql',label:'Análisis SQL y asistentes',detail:'Mostrar u ocultar agrupaciones, tablas dinámicas (pivot) y cruces de archivos con DuckDB',disabled:false,run:()=>{showQuery=false;return toggleDock('sql')}},
  {id:'statistics',label:'Estadísticas y exploración',detail:'Mostrar u ocultar perfiles, frecuencias, valores faltantes, duplicados y correlación',disabled:false,run:()=>toggleDock('resumen')},
  {id:'charts',label:'Gráficos',detail:'Mostrar u ocultar histogramas, barras, líneas, dispersión, mapas de calor y cajas',disabled:false,run:()=>{showQuery=false;return toggleDock('graficos')}},
  {id:'dockExpand',label:'Ampliar panel de análisis',detail:'El panel ocupa toda el área de trabajo; la tabla se conserva · «Volver a la tabla» o Escape lo acopla',disabled:!dockOpen||mode==='expanded',run:()=>setExpanded(true)},
  {id:'dockDock',label:'Acoplar panel de análisis',detail:'Devuelve el panel junto a la tabla (no disponible con la ventana estrecha)',disabled:mode!=='expanded'||narrow,run:()=>setExpanded(false)},
  {id:'columnFilter',label:'Filtrar esta columna',detail:'Muestra los filtros por columna y lleva el foco al de esta columna',disabled:large||interpreting||targetColumn===undefined,run:filterColumn},
  {id:'columnStats',label:'Estadísticas de la columna',detail:'Abre el resumen con esta columna marcada: faltantes, únicos, duplicados y distribución',disabled:large||targetColumn===undefined,run:columnStatistics},
  ...([['upper','Mayúsculas en la columna…','Convertir a mayúsculas'],['lower','Minúsculas en la columna…','Convertir a minúsculas'],['trim','Quitar espacios en la columna…','Quitar espacios al inicio y al final']] as const).map(([operation,label,title])=>({id:'column-'+operation,label,detail:`${title} en toda la columna de la vista actual · vista previa antes → después, recuento y un paso de deshacer`,disabled:locked||busy||!page.matched||targetColumn===undefined,run:()=>cleanColumn(operation)})),
  {id:'columnDuplicates',label:'Quitar filas duplicadas de la columna…',detail:'Compara el texto exacto de esta columna y conserva la primera fila · vista previa, recuento y un paso de deshacer',disabled:locked||targetColumn===undefined,run:()=>openTransform('deduplicate')},
  {id:'transformations',label:'Transformar documento…',detail:'Asistente para dividir/combinar columnas, normalizar, eliminar duplicados, mover filas/columnas y fijar orden · vista previa · Ctrl/⌘ + Mayús + T',disabled:locked||(doc.headers?.length??0)>200,run:openTransform},
  {id:'insertRow',label:'Añadir fila',detail:'Después de la última fila marcada por número; sin marcas, al final del documento',disabled:locked,run:()=>edit({type:'insertRow',afterId:selectedRows.at(-1)})},
  {id:'insertRowBefore',label:'Insertar fila arriba',detail:'Antes de una única fila marcada, en el orden del documento',disabled:locked||selectedRows.length!==1,run:()=>edit({type:'insertRow',beforeId:selectedRows[0]})},
  {id:'insertRowAfter',label:'Insertar fila abajo',detail:'Después de una única fila marcada, en el orden del documento',disabled:locked||selectedRows.length!==1,run:()=>edit({type:'insertRow',afterId:selectedRows[0]})},
  {id:'insertColumnBefore',label:'Insertar columna a la izquierda',detail:'Antes de una única columna marcada',disabled:locked||selectedColumns.length!==1,run:()=>edit({type:'insertColumn',index:selectedColumns[0],name:`Columna ${(doc.headers?.length??0)+1}`})},
  {id:'insertColumnAfter',label:'Insertar columna a la derecha',detail:'Después de una única columna marcada',disabled:locked||selectedColumns.length!==1,run:()=>edit({type:'insertColumn',index:selectedColumns[0]+1,name:`Columna ${(doc.headers?.length??0)+1}`})},
  {id:'sortAscending',label:'Ordenar columna ascendente (vista)',detail:numeric?'Orden numérico exacto; no cambia el orden del archivo':'Orden textual; no cambia el orden del archivo',disabled:large||interpreting||selectedColumns.length!==1,run:()=>sortBy(selectedColumns[0],false,false)},
  {id:'sortDescending',label:'Ordenar columna descendente (vista)',detail:numeric?'Orden numérico exacto; no cambia el orden del archivo':'Orden textual; no cambia el orden del archivo',disabled:large||interpreting||selectedColumns.length!==1,run:()=>sortBy(selectedColumns[0],false,true)},
  {id:'insertColumn',label:'Añadir columna',detail:'Al final del documento',disabled:locked,run:()=>edit({type:'insertColumn',index:doc.headers?.length??0,name:`Columna ${(doc.headers?.length??0)+1}`})},
  {id:'duplicateRows',label:'Duplicar filas seleccionadas',detail:'Necesita filas marcadas por su número; conserva las originales',disabled:locked||!selectedRows.length,run:()=>edit({type:'duplicateRows',ids:selectedRows})},
  {id:'duplicateColumn',label:'Duplicar columna seleccionada',detail:'Necesita una columna marcada; restablece filtros y orden al cambiar columnas',disabled:locked||selectedColumns.length!==1,run:()=>edit({type:'duplicateColumn',index:selectedColumns[0]})},
  {id:'deleteRows',label:'Eliminar filas seleccionadas',detail:'Necesita filas marcadas por su número · un paso de deshacer',disabled:locked||!selectedRows.length,run:()=>edit({type:'deleteRows',ids:selectedRows})},
  {id:'deleteColumn',label:'Eliminar columna seleccionada',detail:'Necesita una columna marcada · un paso de deshacer',disabled:locked||selectedColumns.length!==1,run:()=>edit({type:'deleteColumn',index:selectedColumns[0]})},
  ...([['trim','Quitar espacios al inicio y final'],['upper','Convertir a mayúsculas'],['lower','Convertir a minúsculas']] as const).map(([operation,label])=>({id:'rows-'+operation,label,detail:'Filas marcadas por número; columnas marcadas o todas',disabled:locked||!selectedRows.length,run:()=>edit({type:'transform',operation,rowIds:selectedRows,columns:selectedColumns.length?selectedColumns:(doc.headers??[]).map((_,i)=>i)})})),
  {id:'undo',label:'Deshacer edición CSV',detail:'Un paso del historial compartido · Ctrl/⌘ + Z en la tabla',disabled:locked,run:()=>undoEdit()},
  {id:'redo',label:'Rehacer edición CSV',detail:'Un paso del historial compartido · Ctrl/⌘ + Mayús + Z en la tabla',disabled:locked,run:()=>undoEdit(true)},
  {id:'copyMarkdown',label:'Copiar como Markdown',detail:'Rango, filas marcadas o vista filtrada, según la selección',disabled:locked||busy,run:copyMarkdown},
  ...rangeActions.filter(([action])=>action!=='transformations').map(([action,label])=>({id:action,label,detail:'Necesita un rango de celdas seleccionado en la vista',disabled:locked||!cellRange||busy,run:()=>rangeAction(action)}))
 ])
 const contextCommands=$derived((context?.kind==='rows'?['insertRowBefore','insertRowAfter','duplicateRows','deleteRows','rows-trim','rows-upper','rows-lower','transformations','copyMarkdown','undo','redo']:context?.kind==='columns'?['sortAscending','sortDescending','columnFilter','columnStats','column-upper','column-lower','column-trim','columnDuplicates','insertColumnBefore','insertColumnAfter','duplicateColumn','deleteColumn','transformations','copyMarkdown','undo','redo']:[]).map(id=>commands.find(command=>command.id===id)!))
 const rangeCommands=$derived(rangeActions.map(([action])=>commands.find(command=>command.id===action)!))
 function openCommands(){if(showTransform||rangeDialog)return;commandReturn=document.activeElement instanceof HTMLElement?document.activeElement:null;pendingCell=null;context=null;dragging=false;showCommands=true}
 async function closeCommands(){showCommands=false;await tick();if(commandReturn?.isConnected)commandReturn.focus();else commandsButton?.focus()}
 function commandDisabled(id:string){return commands.find(command=>command.id===id)?.disabled??true}
 async function runCommand(id:string){const command=commands.find(command=>command.id===id);if(!command||command.disabled)return;context=null;pendingCell=null;try{await command.run()}catch(error){onerror(String(error))}}
 async function chooseCommand(id:string){const command=commands.find(command=>command.id===id);if(!command||command.disabled)return;await closeCommands();await runCommand(id)}
 function inside(row:number,column:number){return !!cellRange&&row>=cellRange.top&&row<=cellRange.bottom&&column>=cellRange.left&&column<=cellRange.right}
 function selectCell(row:number,column:number,extend=false){
  if(queryError||page.revision!==doc.revision)return
  selectedRows=[];selectionStats=null
  selection=extend&&selection?{...selection,end:{row,column}}:{anchor:{row,column},end:{row,column},query:$state.snapshot(pageQuery),revision:page.revision}
 }
 function beginSelection(event:PointerEvent,row:number,column:number){if(event.button!==0||(event.target as HTMLElement).tagName==='INPUT'||busy)return;event.preventDefault();selectCell(row,column,event.shiftKey);dragging=true;dragPoint={x:event.clientX,y:event.clientY};(event.currentTarget as HTMLElement).focus()}
 $effect(()=>{if(!dragging)return;const timer=setInterval(()=>{const grid=scrollElement;if(!grid)return;const rect=grid.getBoundingClientRect(),{x,y}=dragPoint;const dy=y>rect.bottom-24?32:y<rect.top+44?-32:0;if(rowScale>1&&dy)get(rowsVirtual).scrollToOffset((get(rowsVirtual).scrollOffset??0)+dy);grid.scrollBy({top:rowScale>1?0:dy,left:x>rect.right-24?32:x<rect.left+54?-32:0});const cell=document.elementFromPoint(Math.max(rect.left+54,Math.min(x,rect.right-8)),Math.max(rect.top+(showFilters?80:44),Math.min(y,rect.bottom-8)))?.closest<HTMLElement>('.csv-cell');if(cell&&selection)selection={...selection,end:{row:Number(cell.dataset.row),column:Number(cell.dataset.column)}}},50);return()=>clearInterval(timer)})
 $effect(()=>{const target=pendingCell;void page;void renderedRows;void $rowsVirtual.getVirtualItems();void $columnsVirtual.getVirtualItems();if(target&&!busy)void tick().then(()=>{if(busy||pendingCell!==target)return;const node=scrollElement?.querySelector<HTMLElement>(`.csv-cell[data-row="${target.row}"][data-column="${target.column}"]`);if(node){node.focus({preventScroll:true});if(document.activeElement===node)pendingCell=null}})})
 function focusCell(row:number,column:number,extend=false,align:'auto'|'none'='auto'){if(!page.matched)return;row=Math.max(0,Math.min(row,page.matched-1));column=Math.max(0,Math.min(column,(doc.headers?.length??1)-1));selectCell(row,column,extend);pendingCell={row,column};if(align==='auto')get(rowsVirtual).scrollToIndex(row,{align});get(columnsVirtual).scrollToIndex(column,{align:'auto'});if(row<pageOffset||row>=pageOffset+page.rows.length)void load(Math.floor(row/100)*100)}
 function openContext(x:number,y:number,kind:'range'|'rows'|'columns'='range',origin?:HTMLElement,column?:number){pendingCell=null;contextReturn=origin??(document.activeElement instanceof HTMLElement?document.activeElement:null);context={kind,column,x:Math.max(0,Math.min(x,window.innerWidth-270)),y:Math.max(0,Math.min(y,window.innerHeight-(kind==='columns'?590:370)))}}
 function structuralContext(event:MouseEvent|KeyboardEvent,kind:'rows'|'columns',item:string|number){
  if(event.target instanceof HTMLElement&&event.target.classList.contains('column-filter'))return
  event.preventDefault();event.stopPropagation();if(queryError||page.revision!==doc.revision)return
  selection=null;context=null
  if(kind==='rows'){const id=String(item);if(!selectedRows.includes(id))selectRow(id,false)}else{const column=Number(item);if(!selectedColumns.includes(column))selectColumn(column,true)}
  const element=event.currentTarget as HTMLElement,origin=(event.target instanceof HTMLElement?event.target:element).closest<HTMLElement>('button,input')??element.querySelector<HTMLElement>('button,input')??element,rect=origin.getBoundingClientRect()
  openContext(event instanceof MouseEvent?event.clientX:rect.left,event instanceof MouseEvent?event.clientY:rect.bottom,kind,origin)
 }

 // El mismo menú que el clic derecho de la cabecera, ahora con un botón visible. Actúa solo sobre su columna.
 function columnMenu(event:MouseEvent,index:number){
  event.stopPropagation();if(queryError||page.revision!==doc.revision)return
  if(context?.kind==='columns'&&context.column===index){closeContext();return}
  selection=null;context=null;selectedColumns=[index];void stats()
  const origin=event.currentTarget as HTMLElement,rect=origin.getBoundingClientRect()
  openContext(rect.left,rect.bottom+4,'columns',origin,index)
 }
 function structuralKey(event:KeyboardEvent,kind:'rows'|'columns',item:string|number){if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)structuralContext(event,kind,item)}
 // Una acción enfocada que se deshabilita durante la carga puede devolver el foco al documento.
 $effect(()=>{void busy;void contextCommands;const menu=contextMenu;if(context&&menu&&(!menu.contains(document.activeElement)||document.activeElement?.matches(':disabled')))(menu.querySelector<HTMLButtonElement>('button:not(:disabled)')??menu).focus()})
 function closeContext(){const kind=context?.kind;context=null;if(kind==='range'&&selection)focusCell(selection.end.row,selection.end.column,true);else if(contextReturn?.isConnected)contextReturn.focus();else commandsButton?.focus()}
 async function rangeAction(action:string){
  context=null;pendingCell=null;if(!cellRange||locked||busy)return
  try{if(action==='copy'){await window.freya.tableCopy(doc.id,{scope:'selection',range:$state.snapshot(cellRange)},'tsv');onstatus('Rango copiado');return}
   if(action==='paste'){preparePaste(await window.freya.tablePaste(doc.id,$state.snapshot(cellRange)));return}
   rangeDialog={edit:{type:'range',range:$state.snapshot(cellRange),operation:(action==='cut'?'clear':action) as TableRangeEdit['operation'],value:'',find:''},cut:action==='cut'}
  }catch(error){onerror(action==='paste'?'No se pudo leer el portapapeles. Usa Ctrl/⌘ + V sobre la tabla.':String(error))}
 }
 function openTransform(start?:import('../../shared/types').TableTransformEdit['operation']){if(locked)return;transformStart=start;if((doc.headers?.length??0)>200){onerror('Estas transformaciones admiten hasta 200 columnas por documento.');return}context=null;pendingCell=null;showTransform=true}
 async function applyTransform(change:import('../../shared/types').TableTransformEdit){const error=await edit(change);if(error===null){if(['moveRows','moveColumns','commitOrder'].includes(change.operation)){search='';filters={};sort=undefined;conditions=[];order=[];showQuery=false}selection=null;selectedRows=[];selectedColumns=[];selectionStats=null;await load(0);scrollElement?.scrollTo({top:0,left:0})}return error}
 function closeTransform(){showTransform=false;transformStart=undefined;if(selection)focusCell(selection.end.row,selection.end.column,true);else document.querySelector<HTMLElement>('[aria-label="Operaciones CSV"]')?.focus()}
 function preparePaste(text:string){if(!cellRange||locked)return;try{rangeDialog={edit:{type:'range',range:$state.snapshot(cellRange),operation:'paste',values:parse(text,{delimiter:'\t',relax_column_count:true,skip_empty_lines:false}) as string[][]}}}catch(error){onerror(String(error))}}
 async function applyRange(change:TableRangeEdit,cancelled:()=>boolean){try{if(rangeDialog?.cut)await window.freya.tableCopy(doc.id,{scope:'selection',range:change.range},'tsv');if(cancelled())return 'Preparación del rango cancelada.';return await edit(change)}catch(error){const message=String(error).replace(/^.*Error: /,'');onerror(message);return message}}
 function closeRangeDialog(){const documentScope=rangeDialog?.documentScope,fromColumn=!!rangeDialog?.column;rangeDialog=null;if(documentScope)void tick().then(()=>replaceInput?.focus());else if(selection)focusCell(selection.end.row,selection.end.column,true);else if(fromColumn)void tick().then(()=>{if(contextReturn?.isConnected)contextReturn.focus()})}
 function gridKey(event:KeyboardEvent){
  const target=event.target as HTMLElement,command=event.metaKey||event.ctrlKey
  if(target.tagName==='INPUT'||target.tagName==='TEXTAREA')return
  if(command&&event.shiftKey&&event.key.toLowerCase()==='t'){event.preventDefault();void runCommand('transformations');return}
  if(command&&event.key.toLowerCase()==='z'){event.preventDefault();void runCommand(event.shiftKey?'redo':'undo');return}
  if(command&&event.key.toLowerCase()==='c'&&(cellRange||selectedRows.length)){event.preventDefault();void(cellRange?rangeAction('copy'):copyCells());return}
  if(command&&event.key.toLowerCase()==='x'&&cellRange){event.preventDefault();void rangeAction('cut');return}
  if(command&&event.key.toLowerCase()==='a'&&page.matched){event.preventDefault();selectCell(0,0);selectCell(page.matched-1,(doc.headers?.length??1)-1,true);return}
  const row=Number(target.closest<HTMLElement>('.csv-cell')?.dataset.row),column=Number(target.closest<HTMLElement>('.csv-cell')?.dataset.column)
  if(!Number.isInteger(row)||!Number.isInteger(column))return
  if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){event.preventDefault();if(!inside(row,column))selectCell(row,column);const rect=target.getBoundingClientRect();openContext(rect.left,rect.bottom);return}
  if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','PageDown','PageUp'].includes(event.key)){event.preventDefault();let nextRow=row,nextColumn=column;if(event.key==='ArrowDown')nextRow++;if(event.key==='ArrowUp')nextRow--;if(event.key==='ArrowRight')nextColumn++;if(event.key==='ArrowLeft')nextColumn--;if(event.key==='PageDown')nextRow+=Math.max(1,Math.floor((scrollElement?.clientHeight??320)/32)-1);if(event.key==='PageUp')nextRow-=Math.max(1,Math.floor((scrollElement?.clientHeight??320)/32)-1);if(event.key==='Home'){nextColumn=0;if(command)nextRow=0}if(event.key==='End'){nextColumn=(doc.headers?.length??1)-1;if(command)nextRow=page.matched-1}focusCell(nextRow,nextColumn,event.shiftKey);return}
  if((event.key==='Delete'||event.key==='Backspace')&&cellRange){event.preventDefault();void rangeAction('clear')}
  if(event.key==='Enter'&&command&&cellRange){event.preventDefault();void rangeAction('fill')}
  if(event.key==='Escape'){selection=null;context=null}
 }
 const features=tableFeatures({})
 const table=createTable({features,get columns(){return(doc.headers??[]).map((name,index)=>({id:String(index),header:name,accessorFn:(row:{id:string;cells:string[]})=>row.cells[index]}))},get data(){return page.rows},getRowId:row=>row.id})
 // Con más filas de las que caben en un elemento, la barra se escala (ver lib/virtual-scroll.ts): el virtualizador trabaja en píxeles lógicos y el DOM en físicos.
 let rowScale=$state(1),viewHeight=$state(0)
 const rowsVirtual=createVirtualizer<HTMLDivElement,HTMLDivElement>({count:0,getScrollElement:()=>scrollElement??null,estimateSize:()=>32,overscan:8,paddingStart:40,observeElementOffset:(instance,callback)=>observeElementOffset(instance,(offset,scrolling)=>callback(toLogical(offset,rowScale),scrolling)),scrollToFn:(offset,{adjustments=0,behavior},instance)=>instance.scrollElement?.scrollTo({top:toPhysical(offset+adjustments,rowScale),behavior})})
 // La biblioteca acota los desplazamientos con el alto físico del elemento (scrollHeight − clientHeight): con la barra escalada el máximo es el lógico.
 {const rows=get(rowsVirtual) as unknown as {getMaxScrollOffset:()=>number;getTotalSize:()=>number},physicalMax=rows.getMaxScrollOffset;rows.getMaxScrollOffset=()=>rowScale>1?Math.max(rows.getTotalSize()-(scrollElement?.clientHeight??0),0):physicalMax()}
 const columnsVirtual=createVirtualizer<HTMLDivElement,HTMLDivElement>({horizontal:true,count:0,getScrollElement:()=>scrollElement??null,estimateSize:()=>180,overscan:2,paddingStart:52})
 const rowMap=$derived(new Map(table.getRowModel().rows.map(row=>[row.original.id,row.original])))
 const renderedRows=$derived(page.rows.map(row=>rowMap.get(row.id)!).filter(Boolean))
 $effect(()=>{const count=page.matched,padding=showFilters?76:40,columns=doc.headers?.length??0;get(rowsVirtual).setOptions({count,paddingStart:padding});get(columnsVirtual).setOptions({count:columns})})
 // Si cambia la escala (otro número de filas, otra altura del visor) se conserva la posición lógica, no la física. Excepto al final: el navegador ya recortó `scrollTop`
 // al nuevo máximo y la posición lógica, calculada con la escala anterior, lo dejaría decenas de filas antes (el cociente de escalas no es 1).
 $effect(()=>{const total=$rowsVirtual.getTotalSize(),next=scrollScale(total,viewHeight);untrack(()=>{if(next===rowScale)return;const element=scrollElement,logical=get(rowsVirtual).scrollOffset??0;rowScale=next;if(!element)return;const end=scrollHeight(total)-element.clientHeight;element.scrollTo({top:end>0&&element.scrollTop>=end-1?end:toPhysical(logical,next)})})})
 // Con la barra escalada, una muesca de la rueda mueve filas reales (no `escala` veces más) y la barra se usa para los saltos grandes.
 function wheelRows(node:HTMLElement){const onwheel=(event:WheelEvent)=>{if(rowScale<=1||event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;event.preventDefault();const lines=event.deltaMode===1?32:event.deltaMode===2?node.clientHeight:1,rows=get(rowsVirtual);rows.scrollToOffset((rows.scrollOffset??0)+event.deltaY*lines)};node.addEventListener('wheel',onwheel,{passive:false});return{destroy:()=>node.removeEventListener('wheel',onwheel)}}
 let pageQuery=$state<TableQuery>({offset:0,limit:200,requestId:0})
 const appliedSearch=$derived((pageQuery.search??'').toLocaleLowerCase())
 function query(offset=0):TableQuery{return{search,conditions:$state.snapshot(conditions),filterMode,order:order.length?$state.snapshot(order):undefined,filters:$state.snapshot(filters),sort:sort?$state.snapshot(sort):undefined,offset,limit:200,requestId}}
 async function load(offset=0){const q={...query(offset),requestId:++requestId};busy=true;try{const result=await window.freya.tablePage(doc.id,q);if(result.requestId!==requestId)return;queryError='';pageOffset=offset;page=result;pageQuery=q;onstatus(`${result.matched.toLocaleString()} de ${result.total.toLocaleString()} filas${result.large?' · archivo grande':result.sample?' · muestra':''}`)}catch(error){if(q.requestId===requestId){queryError=String(error).replace(/^.*Error: /,'');onerror(queryError)}}finally{if(q.requestId===requestId)busy=false}}
 $effect(()=>{const signature=JSON.stringify([doc.id,doc.revision,search,filters,sort,conditions,filterMode,order]);void signature;untrack(()=>{selectedRows=[];selectionStats=null;selection=null;context=null;rangeDialog=null;pendingCell=null;dragging=false;scrollElement?.scrollTo({top:0})});const timer=setTimeout(()=>void load(0),150);return()=>clearTimeout(timer)})
 $effect(()=>{const items=$rowsVirtual.getVirtualItems(),first=items[0]?.index??0,last=items.at(-1)?.index??0;if(items.length&&!busy&&(first<pageOffset||last>=pageOffset+page.rows.length))untrack(()=>void load(Math.floor(first/100)*100))})
 // «Ir a la fila N»: la numeración es la de la columna #. Escribe el desplazamiento directamente en el elemento (centrando la fila) en lugar de pedírselo a
 // `scrollToIndex`: con el desplazamiento escalado de tablas de millones de filas su máquina de estados confunde la posición lógica con la física y se queda a medio camino.
 function centerRow(index:number){
  const element=scrollElement;if(!element)return
  const height=element.clientHeight,pad=showFilters?76:40,max=Math.max(get(rowsVirtual).getTotalSize()-height,0)
  const logical=Math.max(0,index*32-(height-pad-32)/2)
  // En el último tramo se pide el final físico (el navegador lo acota): la conversión lógica→física redondea y dejaría la última fila fuera de la vista.
  element.scrollTo({top:logical>=max?element.scrollHeight:toPhysical(logical,rowScale)})
 }
 async function openGoto(){pendingCell=null;showGoto=true;gotoError='';await tick();gotoInput?.focus();gotoInput?.select()}
 function closeGoto(){showGoto=false;gotoError='';void tick().then(()=>gotoButton?.focus())}
 function goToRow(){
  const row=gotoValue
  if(row===null||!Number.isInteger(row)||row<1||row>page.matched){gotoError=`Escribe un número entre 1 y ${page.matched.toLocaleString()}.`;void tick().then(()=>gotoInput?.focus());return}
  showGoto=false;gotoError='';centerRow(row-1);focusCell(row-1,0,false,'none');announcement=`Fila ${row.toLocaleString()} de ${page.matched.toLocaleString()}`
 }
 async function focusReplace(){pendingCell=null;showReplace=true;if(!replaceFind)replaceFind=search;await tick();replaceInput?.focus();replaceInput?.select()}
 function searchKey(event:KeyboardEvent){
  const target=event.target
  if(!(target instanceof HTMLElement)||event.defaultPrevented||!(event.metaKey||event.ctrlKey)||event.altKey||!['f','k','g'].includes(event.key.toLowerCase())||!target.closest('.csv-workspace')||target.closest('.cm-editor'))return
  event.preventDefault();pendingCell=null;const key=event.key.toLowerCase();if(key==='k')openCommands();else if(key==='g')void runCommand('goToRow');else void runCommand(event.shiftKey?'replaceDocument':'search')
 }
 function prepareReplacement(){
  if(locked||busy||!replaceFind||!doc.rowCount||!doc.headers?.length)return
  const left=selectedColumns.length===1?selectedColumns[0]:0,right=selectedColumns.length===1?left:doc.headers.length-1
  rangeDialog={documentScope:true,edit:{type:'range',operation:'replace',find:replaceFind,value:replaceWith,range:{top:0,bottom:doc.rowCount-1,left,right,revision:doc.revision,query:{offset:0,limit:200,requestId:0}}}}
 }
 function update(updated:DocumentInfo){if(updated.headers?.length!==doc.headers?.length){filters={};sort=undefined;conditions=[];order=[];showQuery=false;selectedColumns=[]}onchange(updated)}
 async function edit(change:TableEdit){if(locked)return 'La vista no permite editar.';try{update(await window.freya.tableEdit(doc.id,$state.snapshot(change)));editing=null;await load(pageOffset);await stats();return null}catch(error){const message=String(error).replace(/^.*Error: /,'');onerror(message);return message}}
 async function stats(){if(large||!selectedRows.length){selectionStats=null;return}try{selectionStats=await window.freya.stats(doc.id,$state.snapshot(selectedRows),selectedColumns.length?$state.snapshot(selectedColumns):(doc.headers??[]).map((_,i)=>i))}catch(error){onerror(String(error))}}
 function selectRow(id:string,add:boolean){selection=null;context=null;selectedRows=add?(selectedRows.includes(id)?selectedRows.filter(x=>x!==id):[...selectedRows,id]):[id];void stats()}
 function selectColumn(index:number,replace=false){selection=null;context=null;selectedColumns=replace?[index]:selectedColumns.includes(index)?selectedColumns.filter(x=>x!==index):[...selectedColumns,index];void stats()}
 function sortBy(column:number,append=false,descending?:boolean){if(large)return;const current=activeOrder.find(item=>item.column===column),next={column,descending:descending??(current?!current.descending:false),numeric};if(append){order=current?activeOrder.map(item=>item.column===column?next:item):[...activeOrder,next];sort=undefined}else{sort=next;order=[]}}
 function applyQuery(next:TableFilter[],sorts:TableSort[],mode:'all'|'any'){conditions=next;order=sorts;filterMode=mode;sort=undefined;showQuery=false;queryButton?.focus()}

 function setFilter(column:number,value:string){filters={...filters,[column]:value}}
 async function copyMarkdown(){try{await window.freya.tableCopy(doc.id,{scope:cellRange||selectedRows.length?'selection':'filtered',range:cellRange?$state.snapshot(cellRange):undefined,rowIds:$state.snapshot(selectedRows),columns:selectedColumns.length?$state.snapshot(selectedColumns):undefined,query:query()},'markdown');onstatus('Tabla Markdown copiada')}catch(error){onerror(String(error))}}
 async function paste(event:ClipboardEvent,rowId:string,column:number){if(locked)return;const value=event.clipboardData?.getData('text/plain');if(value===undefined)return;if((event.target as HTMLElement).tagName==='INPUT'&&!value.includes('\t')&&!value.includes('\n'))return;event.preventDefault();if(cellRange&&(event.target as HTMLElement).tagName!=='INPUT'){preparePaste(value);return}try{const lines=parse(value,{delimiter:'\t',relax_column_count:true,skip_empty_lines:false}) as string[][];await edit({type:'paste',rowId,column,values:lines,view:{query:pageQuery,revision:page.revision}})}catch(error){onerror(String(error))}}
 async function copyCells(){try{await window.freya.tableCopy(doc.id,{scope:'selection',rowIds:$state.snapshot(selectedRows),columns:selectedColumns.length?$state.snapshot(selectedColumns):undefined},'tsv');onstatus('Selección copiada')}catch(error){onerror(String(error))}}
 async function options(change:{encoding?:Encoding;delimiter?:string;header?:boolean}){if(interpreting)return;interpreting=true;editing=null;editingHeader=null;try{onchange(await window.freya.tableOptions(doc.id,change));await load(0)}catch(error){onerror(String(error))}finally{interpreting=false}}
 // Los menús de la barra y de la barra de estado son <details>: se cierran al pulsar fuera y con Escape (el foco vuelve a su botón).
 const openMenus=()=>document.querySelectorAll<HTMLDetailsElement>('.csv-toolbar details[open],.statusbar details[open]')
 function closeMenus(target?:Node){for(const menu of openMenus())if(!target||!menu.contains(target))menu.removeAttribute('open')}
 function closeMenu(event:KeyboardEvent){if(event.key!=='Escape')return false;const menu=openMenus()[0];if(!menu)return false;event.preventDefault();menu.removeAttribute('open');menu.querySelector('summary')?.focus();return true}
 export function exportOptions(scope:'all'|'filtered'|'selection'='all'):TableExport{
  return{scope,range:scope==='selection'&&cellRange?$state.snapshot(cellRange):undefined,query:query(),rowIds:scope==='selection'?$state.snapshot(selectedRows):undefined,columns:scope==='selection'&&selectedColumns.length?$state.snapshot(selectedColumns):undefined}
 }
 export async function undoEdit(redo=false){try{update(await window.freya.undo(doc.id,redo));await load(pageOffset)}catch(error){onerror(String(error))}}
</script>
<svelte:window onblur={()=>dragging=false} onpointerup={()=>dragging=false} onpointercancel={()=>dragging=false} onkeydown={event=>{if(closeMenu(event))return;if(event.key==='Tab')pendingCell=null;searchKey(event)}} onpointermove={event=>{dragPoint={x:event.clientX,y:event.clientY}}} onpointerdown={event=>{pendingCell=null;closeMenus(event.target as Node);if(context&&!(event.target as HTMLElement).closest('.range-context,.header-menu'))context=null}}/>
{#snippet statisticsPanel()}{#if large}<section class="large-notice" aria-label="Estadísticas"><p>Las estadísticas de columna aún no están disponibles en archivos grandes: llegan en una fase posterior.</p><p>Mientras tanto, «SQL» y «Gráficos» leen el archivo completo (hasta dos millones de filas u ocho millones de celdas).</p></section>{:else}<CsvStatistics {doc} autofocus={userOpened} range={cellRange} query={query()} queryValid={!queryError} viewMeta={{matched:page.matched,revision:page.revision,requestId:page.requestId,sample:page.sample,query:pageQuery}} columns={selectedColumns} onerror={onerror} {onreport} onclose={()=>closeDock(analyzeButton)}/>{/if}{/snippet}
{#snippet chartsPanel()}{#await import('./CsvCharts.svelte')}<p role="status">Preparando gráficos…</p>{:then module}{#key JSON.stringify(doc.headers)}<module.default {doc} query={query()} queryValid={!queryError&&!busy} {onerror} onclose={()=>closeDock(analyzeButton)}/>{/key}{:catch}<p role="alert">No se pudo cargar el panel de gráficos. Cierra el panel y vuelve a intentarlo.</p>{/await}{/snippet}
{#snippet sqlPanel()}<CsvSql {doc} {onerror} {onreport} onclose={()=>closeDock(analyzeButton)}/>{/snippet}
{#snippet item(id:string)}{@const command=commands.find(command=>command.id===id)}<button disabled={command?.disabled??true} title={command?.detail} onclick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');void runCommand(id)}}>{command?.label}</button>{/snippet}
{#snippet rangeButtons(menu=false)}{#each rangeCommands as command}<button role={menu?'menuitem':undefined} disabled={command.disabled||!cellRange} onclick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');void runCommand(command.id)}}>{command.label}</button>{/each}{/snippet}
{#if showCommands}<CsvCommands {commands} context={doc.readonly?'Muestra de solo lectura: edición y copia tabular bloqueadas.':interpreting?'Interpretando el archivo; edición bloqueada.':queryError?'Consulta no válida: corrige o quita los filtros antes de editar.':busy?'Cargando página; las acciones del rango esperan.':cellRange?`Rango: filas ${cellRange.top+1}–${cellRange.bottom+1}, columnas ${cellRange.left+1}–${cellRange.right+1}.`:`${selectedRows.length} filas marcadas por número · ${selectedColumns.length} columnas marcadas.`} onexecute={id=>void chooseCommand(id)} onclose={()=>void closeCommands()}/>{/if}
{#if showTransform}<CsvTransform {doc} initialOperation={transformStart} initialRows={selectedRows} initialRange={cellRange} viewQuery={query()} initialColumns={selectedColumns.length?selectedColumns:cellRange?Array.from({length:cellRange.right-cellRange.left+1},(_,i)=>cellRange.left+i):[]} onapply={applyTransform} onclose={closeTransform} {onerror}/>{/if}
{#if rangeDialog}<CsvRangePreview id={doc.id} initial={rangeDialog.edit} cut={rangeDialog.cut} documentScope={rangeDialog.documentScope} column={rangeDialog.column} onapply={applyRange} onclose={closeRangeDialog} {onerror}/>{/if}
{#if context}<div bind:this={contextMenu} class="range-context" role="menu" aria-label={context.kind==='rows'?'Acciones de filas':context.kind==='columns'?'Acciones de columnas':'Acciones del rango'} tabindex="-1" style:left={`${context.x}px`} style:top={`${context.y}px`} onkeydown={event=>{const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),index=buttons.indexOf(document.activeElement as HTMLButtonElement);if(event.key==='Escape'){event.preventDefault();closeContext()}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus()}else if(event.key==='Tab')context=null}}>{#if context.kind==='range'}{@render rangeButtons(true)}{:else}{#if context.kind==='columns'&&context.column!==undefined}<span class="dropdown-label" role="presentation">Columna «{columnLabel(context.column)}» · {page.matched.toLocaleString()} {page.matched===1?'fila':'filas'}</span>{#each [['Vista de la tabla',['sortAscending','sortDescending','columnFilter','columnStats']],['Limpiar la columna · con vista previa',['column-upper','column-lower','column-trim','columnDuplicates']],['Estructura',['insertColumnBefore','insertColumnAfter','duplicateColumn','deleteColumn']],['Más',['transformations','copyMarkdown','undo','redo']]] as [title,ids]}<span class="dropdown-label" role="presentation">{title}</span>{#each contextCommands.filter(command=>(ids as string[]).includes(command.id)) as command}<button role="menuitem" title={command.detail} disabled={command.disabled} onclick={()=>{closeContext();void runCommand(command.id)}}>{command.label}</button>{/each}{/each}{:else}<span class="dropdown-label" role="presentation">{selectedRows.length} filas · {selectedColumns.length?`${selectedColumns.length} columnas`:'todas las columnas'}</span>{#each contextCommands as command}<button role="menuitem" title={command.detail} disabled={command.disabled} onclick={()=>{closeContext();void runCommand(command.id)}}>{command.label}</button>{/each}{/if}{/if}</div>{/if}
<div class="csv-workspace">
 <div class="csv-toolbar" class:compact={bodyWidth>0&&bodyWidth<1000} role="toolbar" aria-label="Herramientas de la tabla">
  <div class="search-field"><Icon name="search" size={14}/><input bind:this={searchInput} aria-label="Buscar en tabla" title={large?'La búsqueda llega en una fase posterior (archivos grandes)':'Buscar en tabla · Ctrl/⌘ + F · no distingue mayúsculas'} placeholder={large?'Búsqueda: archivos grandes, próximamente':'Buscar en la tabla…'} disabled={large} bind:value={search}/>{#if search}<button onclick={()=>search=''} aria-label="Borrar búsqueda"><Icon name="x" size={14}/></button>{/if}</div>
  <button aria-label="Reemplazar" aria-expanded={showReplace} disabled={large} title="Reemplazar · Ctrl/⌘ + Mayús + F" onclick={()=>{if(showReplace)showReplace=false;else void runCommand('replaceDocument')}}><Icon name="replace" size={14}/><span class="tool-text">Reemplazar</span></button>
  <details class="insert-menu"><summary bind:this={queryButton} class:active={showFilters||showQuery||viewActive} aria-label="Filtrar" aria-disabled={large} class:disabled={large} title={large?'Los filtros llegan en una fase posterior (archivos grandes)':undefined} onclick={event=>{if(large)event.preventDefault()}}><Icon name="funnel" size={14}/><span class="tool-text">Filtrar</span><Icon name="chevron-down" size={12}/></summary><div class="dropdown">
   <button aria-pressed={showFilters} title={commands.find(command=>command.id==='filters')?.detail} onclick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');void runCommand('filters')}}>Filtros por columna</button>
   {@render item('query')}
   <label class="menu-check"><input type="checkbox" bind:checked={numeric} onchange={()=>{if(sort)sort={...sort,numeric}}}/>Orden numérico</label>
   {#if viewActive}{@render item('clearQuery')}{/if}
  </div></details>
  {#if viewActive}<button class="filter-chip" aria-label={filterCount?`${filterCount} ${filterCount===1?'filtro activo':'filtros activos'}. Quitar filtros y orden`:'Orden activo. Quitar filtros y orden'} title="Quitar filtros y orden" onclick={()=>void runCommand('clearQuery')}>{filterCount?`${filterCount} ${filterCount===1?'filtro':'filtros'}`:'Orden'} <Icon name="x" size={12}/></button>{/if}
  <details class="insert-menu"><summary aria-label="Limpiar datos"><Icon name="wrench" size={14}/><span class="tool-text">Limpiar datos</span><Icon name="chevron-down" size={12}/></summary><div class="dropdown">
   {@render item('transformations')}
   <span class="dropdown-label">Limpiar filas marcadas</span>
   {#each ['rows-trim','rows-upper','rows-lower'] as id}{@render item(id)}{/each}
   <span class="dropdown-note">{selectedRows.length?`${selectedRows.length} filas × ${selectedColumns.length||doc.headers?.length||0} columnas · sin encabezados`:'Marca filas por su número (Ctrl/⌘ o Mayús añade más) y, si quieres limitarlo, columnas.'}</span>
  </div></details>
  <details class="insert-menu"><summary aria-label="Filas y columnas"><Icon name="table" size={14}/><span class="tool-text">Filas y columnas</span><Icon name="chevron-down" size={12}/></summary><div class="dropdown">
   <span class="dropdown-label">Filas</span>
   {#each ['insertRow','insertRowBefore','insertRowAfter','duplicateRows','deleteRows'] as id}{@render item(id)}{/each}
   <span class="dropdown-label">Columnas</span>
   {#each ['insertColumn','insertColumnBefore','insertColumnAfter','duplicateColumn','deleteColumn'] as id}{@render item(id)}{/each}
   <span class="dropdown-label">Copiar</span>
   {@render item('copyMarkdown')}
  </div></details>
  {#if large}<button bind:this={extractButton} aria-label="Extraer filas" aria-expanded={showExtract} title="Crea un archivo nuevo con las filas que cumplan unas condiciones; el original no se modifica" onclick={()=>void runCommand('extract')}><Icon name="funnel" size={14}/><span class="tool-text">Extraer…</span></button>{/if}
  <span class="spacer"></span>
  <span class="goto-wrap"><button bind:this={gotoButton} aria-label="Ir a la fila" aria-expanded={showGoto} title="Ir a la fila · Ctrl/⌘ + G" disabled={!page.matched} onclick={()=>void runCommand('goToRow')}><Icon name="arrow-down" size={14}/><span class="tool-text">Ir a la fila</span></button>{#if showGoto}<form class="goto-popover" novalidate onsubmit={event=>{event.preventDefault();goToRow()}}><label>Ir a la fila <input bind:this={gotoInput} onkeydown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeGoto()}}} type="number" min="1" max={page.matched} step="1" inputmode="numeric" aria-label="Número de fila" aria-invalid={!!gotoError} bind:value={gotoValue} oninput={()=>gotoError=''}/></label><span class="muted">de {page.matched.toLocaleString()}</span><button type="submit">Ir</button><button type="button" onclick={closeGoto}>Cerrar</button>{#if gotoError}<span role="alert" class="goto-error">{gotoError}</span>{/if}</form>{/if}</span>
  <button bind:this={commandsButton} aria-label="Buscar acción" title="Comandos CSV · Ctrl/⌘ + K" onclick={openCommands}><Icon name="command" size={14}/><span class="tool-text">Buscar acción</span></button>
  <button bind:this={analyzeButton} class="analyze" class:active={dockOpen} aria-label="Analizar" aria-expanded={dockOpen} aria-controls="analysis-dock" title="Resumen, gráficos y SQL en un panel lateral" onclick={()=>{showQuery=false;toggleDock(workspace.tab)}}><Icon name="chart-column" size={14}/><span class="tool-text">Analizar</span></button>
 </div>
 {#if showExtract&&large}<CsvExtract {doc} {onerror} onclose={()=>{showExtract=false;extractButton?.focus()}}/>{/if}
 {#if showQuery}<CsvQueryTools headers={doc.headers??[]} initialConditions={conditions} initialOrder={activeOrder} initialMode={filterMode} onapply={applyQuery} onclose={()=>{showQuery=false;queryButton?.focus()}}/>{/if}
 {#if queryError}<div class="warning-banner" role="alert">Consulta no aplicada. Se conserva la última vista válida. {queryError} Corrige o limpia la consulta para editar. <button disabled={busy} onclick={()=>void load(0)}>Reintentar consulta</button></div>{/if}
 {#if doc.extract}<div class="warning-banner extract-banner" role="note"><strong>Extracto de «{doc.extract.sourceName}»</strong> · {doc.extract.matched.toLocaleString('es')} de {doc.extract.total.toLocaleString('es')} filas{#if doc.extract.conditions} · {doc.extract.conditions}{/if}{#if doc.extract.columns} · columnas: {doc.extract.columns.join(', ')}{/if} · {fidelityLabel[doc.extract.fidelity]}.{#each doc.extract.normalization as note} {note}{/each}{#if doc.extract.irregularRows} {doc.extract.irregularRows.toLocaleString('es')} filas con distinto número de campos que el encabezado se conservaron como estaban.{/if} El original no se modificó.</div>{/if}
 {#if doc.warning||doc.readonly}<div class="warning-banner">{doc.warning??'Solo lectura'}{#if page.sample} Los filtros y recuentos describen únicamente la muestra.{/if}</div>{/if}
 {#if showReplace}<form class="csv-toolbar" onsubmit={event=>{event.preventDefault();prepareReplacement()}}><input bind:this={replaceInput} aria-label="Buscar valor para reemplazar" placeholder="Buscar valor" bind:value={replaceFind}/><input aria-label="Nuevo valor" placeholder="Reemplazar por" bind:value={replaceWith}/><span class="muted">{selectedColumns.length===1?'Columna marcada':'Todas las columnas'} · documento completo, incluye filas ocultas · literal, distingue mayúsculas</span><button disabled={locked||busy||!replaceFind||!doc.rowCount||!doc.headers?.length} type="submit">Vista previa del reemplazo</button></form>{/if}
 <div class="csv-body" class:expanded={mode==='expanded'} bind:clientWidth={bodyWidth}>
  <div class="csv-main">
 <div class="csv-scroll" bind:this={scrollElement} bind:clientHeight={viewHeight} use:wheelRows role="grid" aria-label="Tabla de datos" aria-rowcount={page.matched+1} aria-colcount={(doc.headers?.length??0)+1} tabindex="0" aria-multiselectable="true" onkeydown={gridKey}>
  <div class="virtual-table" style:height={`${scrollHeight($rowsVirtual.getTotalSize())}px`} style:width={`${Math.max($columnsVirtual.getTotalSize(),scrollElement?.clientWidth??0)}px`}>
   <div class="csv-header" role="row" style:height={showFilters?'76px':'40px'}>
    <div class="row-number corner">#</div>
    {#each $columnsVirtual.getVirtualItems() as col (col.key)}
     <div class="column-header" role="columnheader" tabindex="-1" oncontextmenu={event=>structuralContext(event,'columns',col.index)} onkeydown={event=>structuralKey(event,'columns',col.index)} aria-sort={activeOrder.find(item=>item.column===col.index)?.descending===true?'descending':activeOrder.some(item=>item.column===col.index)?'ascending':'none'} style:left={`${col.start}px`} style:width={`${col.size}px`}>
      {#if editingHeader?.index===col.index}<input class="column-filter" aria-label="Nombre del encabezado" bind:value={editingHeader.value} use:focus onblur={()=>{if(editingHeader){void edit({type:'header',index:col.index,name:editingHeader.value});editingHeader=null}}} onkeydown={event=>{if(event.key==='Enter')event.currentTarget.blur();else if(event.key==='Escape')editingHeader=null}}/>{:else}<div class="column-title"><input class="column-select" type="checkbox" aria-label={`Seleccionar columna ${doc.headers?.[col.index]}`} checked={selectedColumns.includes(col.index)} onchange={()=>selectColumn(col.index)}/><button class="sort-button" title={large?'Ordenar llega en una fase posterior (archivos grandes)':'Ordenar columna'} disabled={large} onclick={event=>sortBy(col.index,event.shiftKey)}>{doc.headers?.[col.index]||`Columna ${col.index+1}`} {#if activeOrder.some(item=>item.column===col.index)}<Icon name={activeOrder.find(item=>item.column===col.index)?.descending?'arrow-down':'arrow-up'} size={12}/>{/if}</button><button class="header-edit" title="Editar encabezado" aria-label={`Editar encabezado ${col.index+1}`} disabled={locked} onclick={()=>editingHeader={index:col.index,value:doc.headers?.[col.index]??''}}><Icon name="pencil" size={12}/></button><button class="header-menu" aria-label={`Acciones de la columna ${columnLabel(col.index)}`} aria-haspopup="menu" aria-expanded={context?.kind==='columns'&&context.column===col.index} title="Ordenar, filtrar, estadísticas y limpieza de la columna" onclick={event=>columnMenu(event,col.index)}><Icon name="chevron-down" size={12}/></button></div>{/if}
      {#if showFilters}<input class="column-filter" data-column-filter={col.index} aria-label={`Filtrar ${doc.headers?.[col.index]}`} placeholder="Contiene…" value={filters[col.index]??''} oninput={e=>setFilter(col.index,e.currentTarget.value)}/>{/if}
     </div>
    {/each}
   </div>
   {#each $rowsVirtual.getVirtualItems() as virtualRow (virtualRow.key)}
    {@const row=renderedRows[virtualRow.index-pageOffset]}
    {#if row}<div class="csv-row" class:selected={selectedRows.includes(row.id)} role="row" aria-rowindex={virtualRow.index+2} style:transform={`translateY(${rowTop(virtualRow.start,$rowsVirtual.scrollOffset??0,rowScale)}px)`} style:height={`${virtualRow.size}px`}>
     <button class="row-number" oncontextmenu={event=>structuralContext(event,'rows',row.id)} onkeydown={event=>structuralKey(event,'rows',row.id)} aria-label={`Seleccionar fila ${virtualRow.index+1}`} onclick={event=>selectRow(row.id,event.metaKey||event.ctrlKey||event.shiftKey)}>{virtualRow.index+1}</button>
     {#each $columnsVirtual.getVirtualItems() as col (col.key)}
      {@const value=row.cells[col.index]??''}
      {@const matches=!!appliedSearch&&value.toLocaleLowerCase().includes(appliedSearch)}
      <div class="csv-cell" class:range-selected={inside(virtualRow.index,col.index)} aria-selected={inside(virtualRow.index,col.index)} data-row={virtualRow.index} data-column={col.index} onpointerdown={event=>beginSelection(event,virtualRow.index,col.index)} onpointerenter={()=>{if(dragging&&selection)selection={...selection,end:{row:virtualRow.index,column:col.index}}}} oncontextmenu={event=>{event.preventDefault();if(!inside(virtualRow.index,col.index))selectCell(virtualRow.index,col.index);openContext(event.clientX,event.clientY)}} class:column-selected={selectedColumns.includes(col.index)} role="gridcell" aria-colindex={col.index+2} tabindex="0" aria-label={`Fila ${virtualRow.index+1}, ${doc.headers?.[col.index]}`} style:left={`${col.start}px`} style:width={`${col.size}px`} ondblclick={()=>{if(!locked)editing={rowId:row.id,column:col.index,value:row.cells[col.index]??''}}} onkeydown={event=>{if(!locked&&!event.metaKey&&!event.ctrlKey&&(event.key==='Enter'||event.key==='F2')){event.preventDefault();editing={rowId:row.id,column:col.index,value:row.cells[col.index]??''}}}} onpaste={event=>void paste(event,row.id,col.index)}>
       {#if editing?.rowId===row.id&&editing?.column===col.index}<input class="cell-input" aria-label="Editar celda" bind:value={editing.value} use:focus onblur={()=>{if(editing)void edit({type:'cell',rowId:row.id,column:col.index,value:editing.value})}} onkeydown={event=>{if(event.key==='Enter'&&editing){event.preventDefault();event.currentTarget.blur()}else if(event.key==='Escape'){editing=null}}}/>{:else}<span title={value}>{#if matches}<mark>{value}</mark>{:else}{value}{/if}</span>{/if}
      </div>
     {/each}
    </div>{/if}
   {/each}
  </div>
  {#if !page.matched&&!busy}<div class="table-empty">No hay filas que coincidan. <button onclick={()=>void runCommand('insertRow')} disabled={commandDisabled('insertRow')}>Añadir fila</button></div>{/if}
 </div>
 <!-- Se mueve a la barra de estado de la ventana: así hay una sola barra inferior y la tabla conserva el alto. -->
 <div class="csv-status" use:portal={'#document-status'}>
  {#if busy}<span role="status">Procesando…</span>{/if}
  {#if cellRange}<span role="status">Rango: filas {cellRange.top+1}–{cellRange.bottom+1}, columnas {cellRange.left+1}–{cellRange.right+1} · {((cellRange.bottom-cellRange.top+1)*(cellRange.right-cellRange.left+1)).toLocaleString()} celdas</span><details class="insert-menu"><summary aria-label="Acciones del rango">Rango <Icon name="chevron-down" size={12}/></summary><div class="dropdown">{@render rangeButtons()}</div></details>{:else if selectedRows.length}<span>{selectedRows.length} filas seleccionadas</span>{/if}
  {#if selectionStats}<span>Vacíos: {selectionStats.empty} · Únicos: {selectionStats.unique}</span>{#if selectionStats.numeric}<span class="truncate">Suma: {selectionStats.sum?.toLocaleString()} · Media: {selectionStats.average?.toLocaleString()} · Mín: {selectionStats.min?.toLocaleString()} · Máx: {selectionStats.max?.toLocaleString()}</span>{/if}{/if}
  <label><span class="label-text">Codificación</span> <select aria-label="Codificación" value={doc.encoding} disabled={doc.dirty||interpreting} onchange={e=>void options({encoding:e.currentTarget.value as Encoding})}><option value="utf8">UTF-8</option><option value="utf16le">UTF-16 LE</option><option value="win1252">Windows-1252</option></select></label>
  <label><span class="label-text">Separador</span> <select aria-label="Separador" value={doc.delimiter} disabled={doc.dirty||interpreting} onchange={e=>void options({delimiter:e.currentTarget.value})}><option value=",">Coma</option><option value=";">Punto y coma</option><option value={'\t'}>Tabulación</option><option value="|">Barra vertical</option></select></label>
  <label title="Primera fila como encabezado"><input type="checkbox" aria-label="Primera fila como encabezado" bind:checked={header} disabled={doc.dirty||interpreting} onchange={()=>void options({header})}/><span class="label-text">Encabezado</span></label>
 </div>
  </div>
  {#if mode==='expanded'}<button class="table-strip" onclick={backToTable}>Volver a la tabla</button>{/if}
  {#if dockOpen}<AnalysisDock expanded={mode==='expanded'} {narrow} onexpand={()=>setExpanded(!workspace.expanded)} tab={dockTab} ontab={tab=>{userOpened=true;workspace.tab=tab;saveWorkspace()}} width={workspace.width} area={bodyWidth} onresize={width=>workspace.width=width} oncommit={saveWorkspace} resumen={statisticsPanel} graficos={chartsPanel} sql={sqlPanel}/>{/if}
 </div>
 <p id="dock-announcement" class="sr-only" role="status">{announcement}</p>
</div>
<script lang="ts" module>
 function focus(node:HTMLInputElement){node.focus();node.select()}
 // Lleva el nodo a otro lugar del documento (la barra de estado de la ventana) y lo retira al desmontarse.
 function portal(node:HTMLElement,selector:string){document.querySelector(selector)?.appendChild(node);return{destroy(){node.remove()}}}
</script>
