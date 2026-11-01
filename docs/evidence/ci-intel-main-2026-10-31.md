# Intel fuera de los PR · evidencia · 2026-10-31

## Alcance y base

Autorización del propietario: `codex/ci-intel-main`, un PR en borrador contra `main`, sin fusión, publicación ni actualización de la app instalada. Base comprobada también antes de publicar: `7ba8397b268c49816ada8b9b76986d491930f848`. Worktree independiente; no se modifica el checkout del usuario ni los PR #98–#102.

Se modifica exclusivamente `ci.yml`, los dos terceros argumentos de `it` autorizados y la documentación de política enumerada en el objetivo. `AGENTS.md` conserva su redacción histórica de cuatro plataformas: la excepción explícita del propietario rige esta tarea. No hay cambios de dependencias, fuentes del producto, otros workflows, protección de ramas, aserciones, workers, filtros documentales, plazos globales o gate del paquete.

## Política resultante

| Evento | Jobs Verify | Cancelación |
| --- | --- | --- |
| PR con cambios no excluidos | Ubuntu 24.04, Windows 2025, macOS 15 ARM; Intel no se crea | Un nuevo commit cancela la ejecución anterior del mismo PR |
| Push a `main` con cambios no excluidos | Los tres anteriores más macOS 15 Intel | Grupo único por ejecución; no cancela otra ejecución activa ni sustituye otra pendiente |
| Nocturna sobre `main` | Sólo macOS 15 Intel | Grupo único por ejecución; sin cancelación entre ejecuciones |

Programación: `23 7 * * *`, diariamente a las 07:23 UTC (01:23 en Ciudad de México). Los filtros de documentación de push/PR se conservan exactamente. Intel mantiene 60 minutos; el resto 45. ARM mantiene dos workers de fast; Windows, Linux e Intel, uno. Perf/solo continúa aislado con uno. Los pasos completos de pruebas, licencias y ejecución del paquete son idénticos al baseline.

La matriz dinámica utiliza `fromJSON`, sin duplicar el job ni omitir pasos para pintar Intel en verde. Los grupos de main incluyen `github.run_id`: desactivar `cancel-in-progress` por sí solo no impediría sustituir un pendiente del mismo grupo. Referencias primarias consultadas el 2026-10-31: [concurrencia de GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), [programación de workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Presupuesto explícito de las dos pruebas

Dos puntos de llamada, diez variantes: dos encodings de paridad de 330 consultas y ocho combinaciones de hilos/tope. Única diferencia en cada archivo: `})` pasa a `},10_000)`. El análisis AST comprueba que, retirando el tercer argumento autorizado, el archivo es idéntico byte a byte al baseline. Los límites internos de espera de los helpers y todas las aserciones permanecen intactos.

Evidencia histórica real de Intel, [CI #273, intento 1](https://github.com/ruzer/freyalab/actions/runs/41106447370), head `2e51a72cff21aaf204eb7466480b25fd7a2b2621`: utf8 terminó en 4.577 ms; utf16le agotó 5.000 ms y se registró en 5.080 ms. La variante 8 hilos/tope 3 agotó 5.000 ms y se registró en 5.012 ms. Los otros siete casos de orden registraron entre 147 y 496 ms. Los 5.080/5.012 ms son observaciones censuradas por timeout, no tiempos de finalización. Se eligen 10.000 ms, el doble del presupuesto anterior, para dar margen a esa dispersión sin modificar las comprobaciones de datos ni los límites de rendimiento. No se afirma que Intel termine con este nuevo presupuesto: queda pendiente su primera ejecución en `main` tras la fusión del propietario.

Mac local: MacBook Pro, Apple M2 Max, 32 GB; Node 24.22.1, Vitest 5.0.5. Duraciones exploratorias, no garantías ni mediciones de Intel:

| Variante | Enfocada (ms) | Dentro de la suite completa (ms) |
| --- | ---: | ---: |
| 1 hilos, tope 3 | 44.53 | 74.89 |
| 1 hilos, tope 7 | 26.69 | 32.97 |
| 2 hilos, tope 3 | 33.66 | 58.15 |
| 2 hilos, tope 7 | 27.41 | 57.68 |
| 4 hilos, tope 3 | 28.05 | 53.25 |
| 4 hilos, tope 7 | 34.09 | 53.78 |
| 8 hilos, tope 3 | 34.26 | 54.38 |
| 8 hilos, tope 7 | 39.54 | 47.72 |
| utf8 | 1022.18 | 1300.84 |
| utf16le | 1011.39 | 915.16 |

Las diez pasan solas y dentro de la suite completa. Ninguna otra prueba de la familia agotó su plazo en la ejecución local completa válida; no se modifica ninguna otra. El estado de otros casos en Intel no se ha vuelto a medir en esta tarea.

## Rojo → verde y comandos reales

| Comprobación | Antes del cambio | Después |
| --- | --- | --- |
| Matriz PR, nocturna, programación, aislamiento main y dos argumentos `it` | Seis comprobaciones funcionales rojas | 11/11 comprobaciones verdes en total |
| Pasos/gate, filtros, workers, deadlines y cancelación por PR | Ya conformes | Permanecen idénticos/conformes |
| `node node_modules/vitest/vitest.mjs run tests/large-view.test.ts tests/large-view-order.test.ts -t 'paridad de 330 consultas\|hilos, tope' --reporter=default --reporter=json --outputFile=…` | El rojo de timeout real de Intel está en la CI histórica citada, no se induce artificialmente aquí | 10 pasan; 17 fuera del filtro, no omitidas en la suite completa; salida 0; 2,29 s |
| `npm run check` | — | 0 errores, 0 avisos; salida 0 |
| `npm test -- --reporter=default --reporter=json --outputFile=…` | Primer intento local restringido: 16 fallos de servidor local `listen EPERM`, una suite de Pandoc fallida; 1.991 pasan y seis sin ejecutar; salida 1 | Mismo código, permisos para servidores locales: 109 archivos, 2.013/2.013 pasan, cero omitidas; salida 0; 15,45 s |
| `npm run build` | — | Salida 0 |
| `git diff --check` | — | Salida 0 |

La suite completa local usó el Pandoc instalado mediante `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc`; no se instala ni incorpora ninguna dependencia. Se conserva el intento `EPERM` y su causa; el segundo intento corrige únicamente esa restricción del entorno.

El verificador temporal emplea `js-yaml` y TypeScript ya instalados: parsea YAML, evalúa únicamente el subconjunto utilizado de expresiones booleanas/JSON con contextos sintéticos PR/push/schedule, compara los pasos y verifica los dos cambios de AST. Esto **no es** una ejecución del evaluador de GitHub para push/nocturna. `red.json`, `green.json`, logs y reportes JSON se preservan en `/private/tmp/freyalab-ci-intel-main-evidence`; copia durable en el directorio de recuperación de esta tarea. Script reproducible al final.

## Trazabilidad

| ID | Commit | Prueba |
| --- | --- | --- |
| CI-1 · matriz, programación, cancelación y política vigente | `65de89d` | 11 comprobaciones del verificador; jobs reales del PR se registrarán en su descripción, sobre el head congelado |
| T-1 · sólo diez presupuestos autorizados | `d8e7279` | AST idéntico al retirar dos argumentos; 10 enfocadas y 2.013 completas pasan |
| DOC-1 · evidencia propia | Commit de este documento | Comandos, rojo conservado, límites y matriz de eventos |

No se crea un commit posterior sólo para anotar el estado de CI: los enlaces, el SHA final y las conclusiones remotas se incorporan a la descripción del PR una vez disponibles. El informe final distingue jobs creados de jobs finalizados.

## No verificado / límites

- Push a `main` y ejecución nocturna: **no ejecutados** antes de fusionar. Sólo se validaron sintaxis y expresiones con contextos sintéticos. El propietario indicará cuándo medir el primer Intel en `main` después de fusionar.
- No se comprobó una cancelación real entre dos ejecuciones nuevas de main ni dos PR consecutivos; la comprobación previa es de las claves/expresiones, sin lanzar corridas adicionales sólo para ello.
- El nuevo plazo de Intel, su duración total y posibles fallos de otros casos de 5 s quedan sin verificar. Ninguna ausencia de Intel en el PR acredita esa plataforma.
- No se ejecutó E2E ni empaquetado local adicional; esas etapas completas siguen en la CI del PR, sin suprimir ni mover pruebas. Su resultado real se registra en el PR; compilar no acredita instalar.
- No se tocaron los PR #98–#102, otros workflows, rama principal, releases ni la aplicación instalada.

## Verificador reproducible sin dependencias nuevas

Guardar el siguiente bloque como `/tmp/verify-ci-intel.cjs` y ejecutar con Node 24: `node /tmp/verify-ci-intel.cjs /ruta/absoluta/al/worktree`. Usa módulos ya presentes tras `npm ci`; el script sólo lee el workflow y las dos pruebas. Para reproducir el rojo se ejecuta sobre la base `7ba8397`, donde seis comprobaciones fallan.

```js
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=process.argv[2],req=require('node:module').createRequire(path.join(root,'package.json')),yaml=req('js-yaml'),ts=req('typescript');
const original=p=>cp.execFileSync('git',['show','7ba8397:'+p],{cwd:root,encoding:'utf8'}),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cfg=yaml.load(read('.github/workflows/ci.yml')),base=yaml.load(original('.github/workflows/ci.yml'));let failures=0;const checks=[];
function check(name,fn){try{fn();checks.push({name,ok:true})}catch(e){failures++;checks.push({name,ok:false,error:e.message})}}
function evaluate(value,github){if(typeof value!=='string')return value;const m=/^\s*\$\{\{([\s\S]*)\}\}\s*$/.exec(value);return m?Function('github','fromJSON','return ('+m[1]+')')(github,JSON.parse):value}
function context(event,id=1,ref='refs/heads/main'){return{event_name:event,run_id:id,ref,workflow:'CI'}}
const matrix=event=>evaluate(cfg.jobs.verify.strategy.matrix.include,context(event));
check('PR exactamente Windows/Linux/ARM, Intel ausente',()=>assert.deepEqual(matrix('pull_request').map(v=>v.os),['ubuntu-24.04','windows-2025','macos-15']));
check('push conserva las cuatro plataformas y sus ejecutables',()=>assert.deepEqual(matrix('push'),base.jobs.verify.strategy.matrix.include));
check('nocturna sólo Intel',()=>assert.deepEqual(matrix('schedule'),base.jobs.verify.strategy.matrix.include.filter(v=>v.os==='macos-15-intel')));
check('una programación diaria a 07:23 UTC',()=>assert.deepEqual(cfg.on.schedule,[{cron:'23 7 * * *'}]));
check('filtros de documentación/push/PR idénticos',()=>{assert.deepEqual(cfg.on.push,base.on.push);assert.deepEqual(cfg.on.pull_request,base.on.pull_request)});
check('pasos, paquete, workers, timeout y permisos idénticos',()=>{for(const k of ['steps','env','timeout-minutes','runs-on'])assert.deepEqual(cfg.jobs.verify[k],base.jobs.verify[k]);assert.deepEqual(cfg.permissions,base.permissions);assert.deepEqual(cfg.jobs.verify.strategy['fail-fast'],base.jobs.verify.strategy['fail-fast'])});
const group=g=>cfg.concurrency.group.replace(/\$\{\{([\s\S]*?)\}\}/g,(_,x)=>String(evaluate('${{'+x+'}}',g)));
check('PR mismo PR conserva grupo y cancelación',()=>{assert.equal(group(context('pull_request',1,'refs/pull/103/merge')),group(context('pull_request',2,'refs/pull/103/merge')));assert.equal(evaluate(cfg.concurrency['cancel-in-progress'],context('pull_request')),true)});
check('PR distintos no comparten grupo',()=>assert.notEqual(group(context('pull_request',1,'refs/pull/103/merge')),group(context('pull_request',2,'refs/pull/104/merge'))));
check('main push/nocturna tienen grupos únicos y no cancelan',()=>{const groups=['push','schedule'].flatMap(e=>[1,2].map(id=>group(context(e,id+(e==='schedule'?2:0)))));assert.equal(new Set(groups).size,4);for(const e of ['push','schedule'])assert.equal(evaluate(cfg.concurrency['cancel-in-progress'],context(e)),false)});
for(const[file,title]of [['tests/large-view.test.ts','paridad de 330 consultas'],['tests/large-view-order.test.ts','hilos, tope']])check(file+': sólo tercer argumento 10000',()=>{
 const text=read(file),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);const calls=[];
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(source)==='it'&&n.arguments[0]?.getText(source).includes(title))calls.push(n);ts.forEachChild(n,visit)}visit(source);assert.equal(calls.length,1);const c=calls[0];assert.equal(c.arguments.length,3);assert.equal(Number(c.arguments[2].getText(source).replaceAll('_','')),10000);const normalized=text.slice(0,c.arguments[1].end)+text.slice(c.arguments[2].end);assert.equal(normalized,original(file));
});
console.log(JSON.stringify({checks,failures,model:'js-yaml syntax; JS-compatible subset of GitHub expressions only, not actual push/schedule dispatch'},null,2));process.exitCode=failures?1:0;
```
