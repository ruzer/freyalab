# M3 — aislamiento real, integración con Electron, memoria, empaquetado y firma de DuckDB nativo (línea B)

Rama `codex/m3-duckdb-aislamiento` (PR #61), apilada sobre M2 (PR #60), en `a7530f8`. **Solo experimentos aislados**: ninguna dependencia entra en el producto (`@duckdb/node-api` 2.0.0-r.1 se instala en una carpeta temporal del ejecutor), no cambia `src/`, no hay firma comercial ni notarización. La incorporación de DuckDB al producto **sigue sin autorizarse**; este documento aporta datos para decidirla.

Etiquetas: **[CI]** medido en la ejecución [40224414342](https://github.com/ruzer/freyalab/actions/runs/40224414342) del flujo `M3 DuckDB isolation (experiment)` en macOS ARM (macos-15), macOS Intel (macos-15-intel), Linux x64 (ubuntu-24.04) y Windows x64 (windows-2025); **[local]** medido en el equipo del usuario (macOS 27.0.1, Apple M2 Max). Las tablas salen de `experiments/duckdb-isolation/ci/aggregate.mjs` sobre los JSON de los artefactos: no están editadas a mano.

## Resumen

1. **Capa del sistema operativo demostrada con DuckDB nativo en las cuatro plataformas [CI].** Un hijo propio (el binario de Electron con `ELECTRON_RUN_AS_NODE=1`) ejecuta las operaciones cerradas de M2 dentro de `sandbox-exec` (macOS), `bubblewrap` (Linux) o un AppContainer sin capacidades con objeto de trabajo (Windows). Dentro de la capa no puede leer un archivo de usuario ajeno, abrir conexiones ni escribir fuera de su carpeta. En **macOS y Linux** tampoco lee `hosts`; en **Windows sí**, porque un AppContainer conserva la lectura de lo que Windows concede a «todos los paquetes de aplicación» (`C:\Windows`, `Program Files`).
2. **Un `utilityProcess` no se puede confinar y por defecto no está confinado [CI].** Dentro de uno, DuckDB y Node leen archivos ajenos, abren red y escriben fuera en las cuatro plataformas. El diseño que funciona es un **hijo propio** lanzado desde el proceso principal bajo la capa, con protocolo por líneas JSON; probado con padre Node, padre Electron sin empaquetar y **aplicación empaquetada**.
3. **La capa no cuesta por operación [CI]**: la autocomprobación tarda lo mismo con y sin capa. Lo que cuesta es el **arranque**, y en Windows mucho (≈ 7–9 s; 33 s el primer arranque del paquete) por PowerShell y la preparación de permisos que un instalador haría una vez.
4. **Memoria:** el proceso conserva su RSS máximo en macOS ARM (≈ 490 MB tras una ordenación de 46 MiB) y no en Windows, Linux ni macOS Intel; **reiniciar el hijo lo devuelve a ≈ 70–130 MB** (150–280 ms en macOS y Linux; 6,7 s en Windows, que incluye el arranque con capa). Solo Windows puede imponer un **tope real** desde fuera: con 1 GiB, la ordenación de 60 millones de filas falla limpiamente con «Out of Memory» en vez de crecer.
5. **Empaquetado y firma:** DuckDB carga, con su hijo confinado, desde los cuatro formatos de instalador del producto (DMG en ARM e Intel, NSIS, AppImage y DEB). Con firma ad hoc y runtime reforzado, macOS 15 (CI) carga el módulo nativo sin `disable-library-validation` y **macOS 27 (local) no**. Un certificado autofirmado no lleva identificador de equipo, así que **la validación de bibliotecas entre equipos no se pudo probar sin un certificado de Apple**.
6. **El lector de DuckDB con esquema explícito no es equivalente al estricto de FreyaLab [CI + local]:** coinciden en 15 de 26 casos hostiles, rechaza más (fin de línea mixto, filas irregulares) y, peor, **acepta o cuenta distinto** en cuatro situaciones (comilla dentro de un campo sin comillas, espacio antes de la comilla, líneas vacías, comilla sin cerrar con el lector no paralelo). Las fronteras de trozo del lector paralelo no fallaron en 64 MiB con 5 tamaños de trozo.

## 1. Aislamiento del sistema operativo

**Mecanismos** (herramientas del propio sistema; `bubblewrap` es un paquete de la distribución): macOS `sandbox-exec` con un perfil que niega red y escritura salvo la carpeta de trabajo y oculta la carpeta ajena; Linux `bubblewrap` (`--ro-bind / /`, `--bind` de la carpeta de trabajo, `--tmpfs` sobre la carpeta ajena, `--unshare-net`, `/etc/hosts` vacío); Windows `windows/appcontainer.ps1`, que crea un perfil de AppContainer sin capacidades, arranca el proceso con `CreateProcessW` y `SECURITY_CAPABILITIES`, lo mete en un objeto de trabajo (`KILL_ON_JOB_CLOSE`, límite de memoria opcional) y concede por ACL solo la escritura en la carpeta de trabajo y la lectura de lo necesario.

| Plataforma | Configuración | Resultado |
|---|---|---|
| macOS ARM | un disparo · Node | deniega 5/5 |
| macOS ARM | un disparo · Electron como Node | deniega 5/5 |
| macOS ARM | persistente · padre Node, hijo Node | deniega 6/6 |
| macOS ARM | persistente · padre Node, hijo Electron | deniega 6/6 |
| macOS ARM | persistente · padre Electron | deniega 6/6 |
| macOS ARM | persistente · aplicación EMPAQUETADA | deniega 6/6 |
| macOS Intel | un disparo · Node | deniega 5/5 |
| macOS Intel | un disparo · Electron como Node | deniega 5/5 |
| macOS Intel | persistente · padre Node, hijo Node | deniega 6/6 |
| macOS Intel | persistente · padre Node, hijo Electron | deniega 6/6 |
| macOS Intel | persistente · padre Electron | deniega 6/6 |
| macOS Intel | persistente · aplicación EMPAQUETADA | deniega 6/6 |
| Linux x64 | un disparo · Node | deniega 5/5 |
| Linux x64 | un disparo · Electron como Node | deniega 5/5 |
| Linux x64 | persistente · padre Node, hijo Node | deniega 6/6 |
| Linux x64 | persistente · padre Node, hijo Electron | deniega 6/6 |
| Linux x64 | persistente · padre Electron | deniega 6/6 |
| Linux x64 | persistente · aplicación EMPAQUETADA | deniega 6/6 |
| Windows x64 | un disparo · Node | deniega 5/5 |
| Windows x64 | un disparo · Electron como Node | deniega 5/5 |
| Windows x64 | persistente · padre Node, hijo Node | **puede: DuckDB sin restricciones lee el archivo de hosts; Node lee el archivo de hosts** |
| Windows x64 | persistente · padre Node, hijo Electron | **puede: DuckDB sin restricciones lee el archivo de hosts; Node lee el archivo de hosts** |
| Windows x64 | persistente · padre Electron | **puede: DuckDB sin restricciones lee el archivo de hosts; Node lee el archivo de hosts** |
| Windows x64 | persistente · aplicación EMPAQUETADA | **puede: DuckDB sin restricciones lee el archivo de hosts; Node lee el archivo de hosts** |

«Deniega N/N» significa que ninguna de las pruebas (leer un archivo de usuario ajeno, leer `hosts`, abrir TCP a un servidor local, escribir fuera de la carpeta, y las mismas lecturas con DuckDB sin restricciones) tuvo éxito. «Un disparo» usa un proceso por operación; «persistente», el worker de M2 con protocolo por líneas. En los «un disparo» de Windows la prueba de `hosts` usa la ruta de Unix (`/etc/hosts`) y no es significativa; los «persistentes» usan la ruta real de Windows.

### Hallazgos de Windows (salieron de la CI, no de la teoría)

1. **El AppContainer sin capacidades + objeto de trabajo ejecuta DuckDB nativo [CI].** El hijo (Node, Electron como Node sin empaquetar, empaquetado y desde el instalador NSIS) pasa la autocomprobación de M2 (10 de 11; la batería de seguridad no es aplicable, ver §7) y **deniega** la lectura de un archivo de usuario ajeno, TCP y la escritura fuera de su carpeta. **Conserva la lectura de `C:\Windows\System32\drivers\etc\hosts`**, que Windows concede a «todos los paquetes de aplicación»: la capa no oculta lo que es legible para cualquier AppContainer.
2. **Electron ≥ 44 se niega a arrancar si la carpeta de instalación tiene una ACE para el SID de un paquete AppContainer pero no para «ALL APPLICATION PACKAGES»** (`install_dir_access.cc`: *«Sandboxed processes cannot read …: its ACL has an entry for an AppContainer package SID but none for ALL APPLICATION PACKAGES»*). Conceder la lectura al SID del helper rompía la propia aplicación; se concede a `S-1-15-2-1`, como hace `Program Files`.
3. **Node resuelve rutas con `lstat` de cada componente desde la raíz de la unidad** y un AppContainer no puede ni leer los atributos de `D:\` (`EPERM: lstat 'D:\'`). Hay que dar lectura **solo a la carpeta** (sin herencia) en cada ancestro. `icacls` recorre el subárbol aunque la ACE no se herede (96 s en `C:\`); editar el DACL por manejador (`SetSecurityInfo`) tampoco lo evita del todo: 1–6 s por carpeta con subárbol grande (6–11 s en total por arranque; en el primer arranque del paquete `D:\a` tardó 20 s y `D:\` 4 s). **Se debe hacer una vez en el instalador**, o evitar el problema instalando bajo `Program Files`, que ya es legible. En una instalación por usuario hay que preparar los ancestros.
4. **Con `node.exe` en `C:\hostedtoolcache` el lanzador se quedaba concediendo traversal en los ancestros de `C:\` (la traza `launcher-trace.txt` se detiene ahí, más de 120 s) y el hijo nunca arrancaba; conceder además la carpeta entera de la instalación de Node (miles de archivos de npm) costaba ≈ 100 s por arranque.** Copiado a una carpeta propia pequeña en `D:` funciona: un producto llevaría su runtime en su propia carpeta.
5. **Electron como Node dentro de un AppContainer necesita `--no-stdio-init`** (`node_main.cc: Unable to open nul device needed for initialization`).
6. **PowerShell no lee un script dentro de `app.asar`** y el AppContainer tampoco puede crear enlaces simbólicos (`EPERM`): lo que ejecuta un proceso externo se desempaqueta (`asarUnpack`).
7. **El objeto de trabajo impone un tope de memoria real [CI]:** con 1 GiB, la ordenación de 60 millones de filas (que sin tope termina en ≈ 5,6 s) falla con `Out of Memory Error: Allocation failure` **de forma controlada**: el proceso sobrevive y devuelve el error. Es lo único de esta sección que macOS y Linux no pueden hacer con las herramientas probadas.
8. **El arranque con capa tarda 7–9 s (33 s el primer arranque del paquete) frente a 0,2–1,1 s sin capa**: PowerShell, compilar el lanzador en memoria y las concesiones de ACL. Una vez en marcha, la autocomprobación tarda lo mismo. Un ejecutable auxiliar nativo y las ACL hechas en el instalador lo reducirían a decenas de milisegundos (no medido).

### Hallazgos de Linux y macOS

- **Ubuntu 24.04 restringe `bubblewrap` sin privilegios [CI]:** con la configuración por defecto falla (`bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`) y solo funciona con `sudo`; con `kernel.apparmor_restrict_unprivileged_userns=0` funciona sin privilegios. Un producto necesita un **perfil de AppArmor** instalado por el paquete DEB, o una alternativa sin espacios de nombres de usuario (Landlock: no probada aquí). Una AppImage sin permisos de administrador no puede instalar ese perfil.
- **`sandbox-exec` está obsoleto** pero funciona en macOS 15 (ARM e Intel) y en macOS 27; su perfil exige rutas reales (`/private/tmp`, no `/tmp`). Es una dependencia de una API que Apple puede retirar.
- **El hijo de Electron-como-Node funciona igual que el de Node en macOS y Linux [CI]**, con el mismo binario del módulo nativo (N-API es estable entre ambos).

## 2. Integración con Electron: `utilityProcess` y el hijo confinado

**`utilityProcess` de Electron (control sin capa):** el mismo sondeo, ejecutado dentro de un `utilityProcess`, puede hacer todo lo que se intentó.

| Plataforma | Lo que puede hacer |
|---|---|
| macOS ARM | 6 de 6: DuckDB sin restricciones lee el archivo ajeno; DuckDB sin restricciones lee el archivo de hosts; Node lee el archivo ajeno; Node lee el archivo de hosts; Node abre una conexión TCP a un servidor local; Node escribe fuera de la carpeta de trabajo |
| macOS Intel | 6 de 6: DuckDB sin restricciones lee el archivo ajeno; DuckDB sin restricciones lee el archivo de hosts; Node lee el archivo ajeno; Node lee el archivo de hosts; Node abre una conexión TCP a un servidor local; Node escribe fuera de la carpeta de trabajo |
| Linux x64 | 6 de 6: DuckDB sin restricciones lee el archivo ajeno; DuckDB sin restricciones lee el archivo de hosts; Node lee el archivo ajeno; Node lee el archivo de hosts; Node abre una conexión TCP a un servidor local; Node escribe fuera de la carpeta de trabajo |
| Windows x64 | 6 de 6: DuckDB sin restricciones lee el archivo ajeno; DuckDB sin restricciones lee el archivo de hosts; Node lee el archivo ajeno; Node lee el archivo de hosts; Node abre una conexión TCP a un servidor local; Node escribe fuera de la carpeta de trabajo |

**Diseño que funciona:** el proceso principal lanza con `child_process.spawn` un hijo (`ELECTRON_RUN_AS_NODE=1`) dentro de la capa y habla con él por líneas JSON en stdin/stdout. En Windows el lanzador reenvía tuberías anónimas heredadas (`-Relay`) en vez de usar una tubería con nombre creada por Node, cuya DACL por defecto no concede escritura a un AppContainer (suposición: no se probó la alternativa). Se reutiliza tal cual el worker de M2 (`worker-core.mjs`), de modo que las operaciones cerradas, la cancelación y la autocomprobación son las mismas.

| Plataforma | Configuración | Arranque sin capa | Arranque con capa | Autocomprobación sin capa | con capa |
|---|---|---|---|---|---|
| macOS ARM | persistente · padre Node, hijo Node | 146.6 ms | 152.7 ms | 1447.5 ms | 1413.3 ms |
| macOS ARM | persistente · padre Node, hijo Electron | 325.7 ms | 188.1 ms | 1479.2 ms | 1444.8 ms |
| macOS ARM | persistente · padre Electron | 207.5 ms | 174.2 ms | 1555.1 ms | 1404.3 ms |
| macOS ARM | persistente · aplicación EMPAQUETADA | 1348.7 ms | 362.6 ms | 3020.5 ms | 1995.5 ms |
| macOS Intel | persistente · padre Node, hijo Node | 234.6 ms | 264.9 ms | 1677.1 ms | 1685.6 ms |
| macOS Intel | persistente · padre Node, hijo Electron | 443.6 ms | 350.5 ms | 2867.8 ms | 2149.2 ms |
| macOS Intel | persistente · padre Electron | 373.1 ms | 362.4 ms | 1804.3 ms | 1775.7 ms |
| macOS Intel | persistente · aplicación EMPAQUETADA | 2607.6 ms | 1044.2 ms | 5314 ms | 4266.6 ms |
| Linux x64 | persistente · padre Node, hijo Node | 153 ms | 156.9 ms | 1368.3 ms | 1382.7 ms |
| Linux x64 | persistente · padre Node, hijo Electron | 178.1 ms | 191.1 ms | 1400 ms | 1498.5 ms |
| Linux x64 | persistente · padre Electron | 186.9 ms | 178.1 ms | 1398.4 ms | 1403.3 ms |
| Linux x64 | persistente · aplicación EMPAQUETADA | 204.5 ms | 186.1 ms | 1498.9 ms | 1425.6 ms |
| Windows x64 | persistente · padre Node, hijo Node | 276 ms | 6814.4 ms | 1709.3 ms | 7979.9 ms |
| Windows x64 | persistente · padre Node, hijo Electron | 210.3 ms | 8175.4 ms | 1597.4 ms | 9383 ms |
| Windows x64 | persistente · padre Electron | 241.1 ms | 8142.5 ms | 1650.8 ms | 9808.5 ms |
| Windows x64 | persistente · aplicación EMPAQUETADA | 1104.5 ms | 33604.5 ms | 4070.2 ms | 16721.9 ms |

En Windows el arranque con capa incluye compilar el lanzador de PowerShell y preparar las ACL (la traza `launcher-trace.txt` de los artefactos lo desglosa); **una vez arrancado, la autocomprobación tarda lo mismo con y sin capa** (diferencia de unos cientos de ms en las cuatro plataformas). Una segunda ejecución sobre el estado fusionado en `main` ([40231623740](https://github.com/ruzer/freyalab/actions/runs/40231623740), también verde en las cuatro) lo confirma y desglosa el arranque de Windows: **el lanzador tarda 0,63 s y las concesiones de ACL 7,8 s**, es decir, el arranque con capa (8,0 s con Node, 9,3–9,6 s con Electron y con el paquete) es casi todo preparación de permisos que haría el instalador; el primer arranque del paquete de la primera ejecución (33,6 s) no se repitió.

### Dependencias de diseño que hay que decidir

1. **El diseño necesita el fusible `RunAsNode` de Electron activado [CI].** Con el fusible desactivado (endurecimiento habitual, aplicado con `@electron/fuses` sobre la aplicación empaquetada) el hijo deja de obedecer `ELECTRON_RUN_AS_NODE`, arranca otra aplicación de Electron y **no responde** (macOS, Windows) o termina de inmediato (Linux). FreyaLab hoy no desactiva ningún fusible, pero si se hace hay que enviar un runtime de Node propio (≈ 100 MB) o un ejecutable auxiliar nativo. Con el fusible activo, cualquier proceso local capaz de lanzar el binario firmado de la aplicación con esa variable ejecuta JavaScript con los permisos del usuario: no amplía lo que el usuario ya puede hacer, pero sí el aprovechamiento del binario firmado.
2. **El anfitrión necesita un tiempo máximo de arranque.** Sin él, un hijo que no responde cuelga la operación (la integración de M3 falla con un mensaje a los 90 s).
3. **El lanzador de Windows no puede ser un script de PowerShell.** Funciona como experimento, pero un producto necesita un ejecutable auxiliar pequeño (C++/Rust/C#) firmado, que cree el AppContainer, el objeto de trabajo y las tuberías, y que no dependa de que PowerShell exista, de la política de ejecución ni de que un antivirus acepte un compilador en memoria (`Add-Type`).
4. **Un script o archivo dentro de `app.asar` no lo lee un proceso externo** (PowerShell, el hijo confinado en Windows): lo que se ejecute fuera de Electron hay que desempaquetarlo (`asarUnpack`).

## 3. Memoria y reciclaje del proceso

| Plataforma | Matar | Latido detenido | Relanzado | Salida parcial | RSS base → máximo (40 operaciones) | Operación pesada: antes → después → tras reiniciar |
|---|---|---|---|---|---|---|
| macOS ARM | 2 ms | true | 173.5 ms | 15 bytes | 99.9 → 134.1 MB | 133.5 → 486.4 → 87.4 MB (reinicio 202.1 ms) |
| macOS Intel | 6.5 ms | true | 276 ms | 15 bytes | 83 → 104.9 MB | 104.4 → 146.1 → 70.3 MB (reinicio 265.9 ms) |
| Linux x64 | 6.8 ms | true | 155.6 ms | 15 bytes | 143.7 → 150.2 MB | 147 → 146.5 → 132.6 MB (reinicio 166 ms) |
| Windows x64 | 24.4 ms | true | 6591.1 ms | 15 bytes | 78.3 → 92 MB | 83 → 85 → 74.1 MB (reinicio 6712.1 ms) |

- **Política medida:** reiniciar el hijo cuando su RSS supera 1,5 veces el de la línea base o tras cualquier operación pesada. Con 40 operaciones pequeñas el RSS casi no crece (+4 a +34 MB) y no hace falta reciclar. Tras una ordenación de 46 MiB macOS ARM se queda en ≈ 490 MB y **el reinicio lo devuelve a ≈ 87 MB** (202 ms); en Intel, Linux y Windows no retuvo memoria apreciable. Con ficheros de 1 GiB, M2 midió que el proceso conserva su pico durante toda la sesión: el reciclaje por umbral es la defensa, y debe aplicarse tras operaciones pesadas, no solo por tiempo.
- **Matar a mitad de operación:** 2–24 ms; el latido del proceso se detiene (comprobación de que murió de verdad, no solo el envoltorio); el reemplazo arranca en 155–280 ms (macOS, Linux) y 6,6 s en Windows (arranque con capa). **DuckDB deja un archivo parcial** en la ruta de salida (15 bytes en estas ejecuciones; hasta 1,6 MB en una local): el contrato debe escribir a un temporal y renombrar, como hace el motor propio de #62, o borrar la salida si se mata.
- **Tope externo:** solo el objeto de trabajo de Windows se probó. En macOS y Linux no se probó ningún límite externo de memoria (en Linux serían `cgroups` o `prlimit`; en macOS no se conoce uno fiable por proceso). `memory_limit` de DuckDB **no** es un tope del proceso (M2: +21 % a +67 %).

```json
{
 "control": {
  "ok": true,
  "rows": 60000000,
  "ms": 5644,
  "rssMB": 69
 },
 "capped1GiB": {
  "result": {
   "ok": false,
   "error": "Out of Memory Error: Allocation failure",
   "ms": 3529,
   "rssMB": 69
  },
  "exitCode": 0,
  "timedOut": false,
  "stderr": "",
  "launcher": {
   "seconds": 3.73,
   "grants": [
    "escritura D:\\a\\_temp\\m3work-node\\heavy-cap => 0 (19 ms)",
    "lectura D:\\a\\_temp\\m3work-node\\runtime => ya concedido",
    "lectura D:\\a\\_temp\\m3app => ya concedido",
    "lectura D:\\a\\freyalab\\freyalab\\experiments => ya concedido",
    "travesia D:\\a\\_temp\\m3work-node => 0 (5 ms)",
    "travesia D:\\a\\_temp => 0 (18 ms)",
    "travesia D:\\a => 0 (1608 ms)",
    "travesia D:\\ => 0 (1385 ms)",
    "travesia D:\\a\\freyalab\\freyalab => 0 (1333 ms)",
    "travesia D:\\a\\freyalab => 0 (1336 ms)"
   ],
   "sid": "S-1-15-2-3511386993-136968436-911282502-3706796059-2723684034-2469664992-1650284507",
   "error": null,
   "timedOut": false,
   "grantsSeconds": 9.53,
   "memoryLimitMB": 1024,
   "exitCode": 0
  }
 }
}
```

## 4. Empaquetado y preparación para firma y notarización

| Plataforma | Formato | Tamaño | Instalación | Ejecución instalada |
|---|---|---|---|---|
| macOS ARM | .dmg | 141 MiB | DMG montado, aplicación copiada con enlaces simbólicos y DMG desmontado | DuckDB v2.0.0; hijo 6 denegados/0 permitidos; 10/11 |
| macOS Intel | .dmg | 146 MiB | DMG montado, aplicación copiada con enlaces simbólicos y DMG desmontado | DuckDB v2.0.0; hijo 6 denegados/0 permitidos; 10/11 |
| Linux x64 | .AppImage | 147 MiB | AppImage extraída | DuckDB v2.0.0; hijo 6 denegados/0 permitidos; 11/11 |
| Linux x64 | .deb | 114 MiB | apt-get install | DuckDB v2.0.0; hijo 6 denegados/0 permitidos; 11/11 |
| Windows x64 | .exe | 118 MiB | NSIS silencioso en carpeta temporal | DuckDB v2.0.0; hijo 4 denegados/2 permitidos; 10/11 |

El DEB y la AppImage se construyen con el mismo `electron-builder` que el producto; el DEB se instala con `apt` en el ejecutor desechable. Sin firma comercial.

| Variante | macOS ARM | macOS Intel | Linux x64 | Windows x64 |
|---|---|---|---|---|
| original | sí (10/11) | sí (10/11) | sí (11/11) | sí (10/11) |
| fusible-runasnode-off | **no**: Error: el proceso auxiliar no respondió en 90000 ms | **no**: Error: el proceso auxiliar no respondió en 90000 ms | **no**: Error: el proceso auxiliar terminó | **no**: Error: el proceso auxiliar no respondió en 90000 ms |
| adhoc-sin-runtime | sí (10/11) | sí (10/11) | — | — |
| adhoc-runtime-sin-dlv | sí (10/11) | sí (10/11) | — | — |
| adhoc-runtime-con-dlv | sí (10/11) | sí (10/11) | — | — |

| Plataforma | Binarios | Estado de firma |
|---|---|---|
| macOS ARM | 16 | firma ad hoc ×15 · firmado + runtime reforzado ×1 |
| macOS Intel | 16 | SIN FIRMAR ×15 · firmado + runtime reforzado ×1 |
| Linux x64 | 8 | sin aplicar ×8 |
| Windows x64 | 9 | firmado ×3 · SIN FIRMAR ×6 |

**macOS [CI y local]**

- **Qué firmar:** los 16 binarios Mach-O del paquete: ejecutable, 4 ayudantes, bibliotecas de Electron y los **dos nativos del motor**: `duckdb.node` (ad hoc en el paquete npm) y `libduckdb.dylib` (65–68 MB), que **ya viene firmada con runtime reforzado por otro equipo (identificador `7NCTQWA3HA`)**. Con un Developer ID propio la validación de bibliotecas rechazará esa biblioteca salvo que se vuelva a firmar con la misma identidad que la aplicación (o se use `disable-library-validation`). `electron-builder` firma los nativos desempaquetados, pero el orden (nativos → frameworks → ayudantes → aplicación) y la identidad común hay que verificarlos en la tubería real.
- **Firma ad hoc [CI, macOS 15]:** con firma ad hoc, con o sin runtime reforzado, con o sin `disable-library-validation`, la aplicación carga DuckDB y lanza su hijo confinado en ARM e Intel (10 de 11 comprobaciones; la 11.ª no es aplicable dentro de la capa).
- **Firma ad hoc [local, macOS 27.0.1]:** con runtime reforzado **sin** `disable-library-validation` la aplicación **no arranca**: *«mapping process and mapped file (non-platform) have different Team IDs»* (ni siquiera carga Electron Framework). Con la excepción, sí. Es decir: el mismo paquete se comporta distinto según la versión de macOS. Una firma ad hoc no tiene equipo, así que **esto no demuestra qué pasa con un Developer ID**.
- **Lo que no se pudo probar:** la validación de bibliotecas **entre equipos** exige un certificado de Apple (un certificado autofirmado tampoco lleva identificador de equipo; las variantes que lo intentaban se retiraron). `signing.mjs --identity "Developer ID Application: …"` ejecuta las dos variantes que faltan (todo con la misma identidad sin la excepción; nativo sin volver a firmar) cuando exista el certificado. **Notarización: no se probó nada.**

**Windows [CI]:** 9 binarios nativos; 3 con Authenticode válido (entre ellos `duckdb.dll`, 61 MB, firmada por su editor) y **6 sin firmar, entre ellos `M3DuckDB.exe` y `duckdb.node`**. Una firma comercial tendría que cubrir al menos el ejecutable, `duckdb.node` y el instalador; SmartScreen no se probó.

**Linux [CI]:** nada que firmar con certificado; la integridad se publica con SHA-256. Binarios nativos: `duckdb.node` (0,5 MB) y `libduckdb.so` (96 MB).

**Fusible `RunAsNode` [CI, las cuatro plataformas]:** con el fusible desactivado en la aplicación empaquetada, el hijo no responde (macOS y Windows, 90 s hasta el tiempo máximo) o termina de inmediato (Linux). Ver §2.

**Tamaño:** el motor desempaquetado ocupa 61 MB (Windows) a 96 MB (Linux) y los instaladores de la mini-aplicación (Electron + DuckDB): DMG 141–146 MiB, NSIS 118 MiB, AppImage 147 MiB, DEB 114 MiB.

## 5. Esquema explícito y lector paralelo

Lector evaluado: `read_csv(columns={c0:'VARCHAR',…}, auto_detect=false, header=true, quote='"', escape='"', strict_mode=true, encoding='utf-8')`, con `parallel=true` y `parallel=false`, y con 1 hilo, frente a `csv-parse` con la misma configuración estricta que valida E1 (#62). 26 casos hostiles y un archivo de 64 MiB con campos multilínea y comillas dobladas leído con 5 tamaños de trozo.

| Plataforma | DuckDB | Coincide | DuckDB rechaza | Ambos rechazan | Acepta lo que el analizador rechaza | Distinto | Estrés de trozos |
|---|---|---|---|---|---|---|---|
| macOS ARM | v2.0.0 | 15 | 3 | 5 | 2 | 1 | idéntico en las 5 configuraciones |
| macOS Intel | v2.0.0 | 15 | 3 | 5 | 2 | 1 | idéntico en las 5 configuraciones |
| Linux x64 | v2.0.0 | 15 | 3 | 5 | 2 | 1 | idéntico en las 5 configuraciones |
| Windows x64 | v2.0.0 | 15 | 3 | 5 | 2 | 1 | idéntico en las 5 configuraciones |

**Lo que dicen los casos [CI y local; idéntico en las cuatro plataformas con DuckDB v2.0.0]:**

- **Coincide (15):** CRLF, LF, solo CR, sin salto final, campo multilínea entre comillas, comillas dobladas, campo vacío final, BOM, byte NUL, solo encabezado, archivo vacío, una columna con salto entre comillas, punto y coma, tabulador y registro de 1,5 MiB.
- **DuckDB rechaza lo que FreyaLab acepta (3, conservador):** fin de línea **mezclado** (CRLF y LF en el mismo archivo: «state machine reached an invalid state»), fila corta y fila con campo de más. Un archivo con saltos mezclados, que L2 y E1 sí soportan, **no se podría leer con DuckDB**: habría que mantener el motor propio como alternativa.
- **Ambos rechazan (5):** texto tras la comilla de cierre, barra invertida antes de la comilla, comilla sin cerrar (con el lector paralelo), UTF-8 no válido.
- **DuckDB acepta lo que el analizador estricto rechaza (peligroso, 2 con el lector paralelo, 4 con el no paralelo):** una comilla en medio de un campo sin comillas (`a"b`) y un espacio antes de la comilla (` "abc"`) los acepta con otra interpretación que `csv-parse`; y con **`parallel=false`** una **comilla sin cerrar** hasta el final del archivo se acepta **descartando en silencio el registro** (ya visto en M2). Con `parallel=true` incluso con un solo hilo se rechaza.
- **Distinto (1):** las **líneas vacías** intermedias. `csv-parse` (y el índice de L2) las cuenta como registros; DuckDB las salta. El recuento de DuckDB no coincidiría con las filas del editor.
- **Tope de registro:** DuckDB acepta registros de hasta 2 MiB por defecto; FreyaLab rechaza los de más de 1 MiB. Con `max_line_size=1048576` coinciden.
- **Fronteras de trozo:** un archivo de 64 MiB (1,3 millones de filas, campos multilínea y comillas dobladas, fin de línea uniforme) leído con el lector paralelo por defecto, con trozos de 8 MiB, 1 MiB y 256 KiB y sin paralelismo da **los mismos valores, byte a byte (SHA-256 sobre todos los campos)** que `csv-parse`. En un primer intento, con fin de línea mezclado, ese mismo archivo falló en todas las configuraciones (solo local).

**Consecuencias para el contrato (R2–R4 de EXTERNAL-ENGINES.md):** (a) `parallel=true` es obligatorio y `max_line_size=1048576` también; (b) el contrato no puede prometer «mismas filas que el editor» si no se valida: el recuento y el contenido de DuckDB pueden diferir en líneas vacías y en comillas fuera de sitio; (c) los archivos con fin de línea mezclado o filas irregulares tienen que seguir por el motor propio; (d) el esquema explícito evita el *sniffing*, pero no sustituye a la validación estricta: sin ella, DuckDB interpreta de otra manera lo que `csv-parse` rechaza.

## 6. Estado de las puertas del RFC §7.4

Criterios de §7.4: (a) viabilidad técnica del binding, (b) aislamiento real en las plataformas de destino, (c) empaquetado, firma y notarización, (d) paridad con el DuckDB-Wasm del producto.

| Puerta | Estado tras M2 | Estado tras M3 |
|---|---|---|
| **(a)** Viabilidad técnica | Aprobada | Sin cambios. Ahora también dentro de un hijo confinado, empaquetado e instalado. |
| **(b)** Aislamiento del sistema operativo | Pendiente (macOS y Linux sí, Windows no) | **Demostrada técnicamente en las cuatro plataformas [CI]**, con condiciones que son trabajo de producto, no del experimento: un **ejecutable auxiliar nativo en Windows** (no PowerShell) y la preparación de ACL en el instalador; un **perfil de AppArmor** para Ubuntu 24.04+ (o Landlock); y aceptar que `sandbox-exec` es una API obsoleta. En Windows el proceso confinado sigue pudiendo leer lo que Windows concede a «todos los paquetes de aplicación» (p. ej. `hosts`). **No se ha construido nada de eso en el producto.** |
| **(c)** Empaquetado, firma y notarización | Pendiente (empaquetado sí, firma no) | **Empaquetado comprobado** en los instaladores DMG (ARM e Intel), NSIS y AppImage/DEB. **Firma y notarización siguen pendientes**: inventario de binarios por firmar hecho, el módulo nativo carga con firma ad hoc (con o sin `disable-library-validation` según la versión de macOS) y falta la prueba con un certificado de Apple y con Authenticode. |
| **(d)** Paridad con Wasm | Aprobada con diferencias | Sin cambios. M3 añade que el **lector** de DuckDB no es equivalente al analizador estricto de FreyaLab (§5). |

## 7. Riesgos y límites

1. **No se firmó nada de verdad.** El resultado de macOS con firma ad hoc **depende de la versión del sistema** (macOS 15 carga sin `disable-library-validation`; macOS 27 no). Un certificado de Developer ID da el mismo identificador de equipo a todo el paquete, pero eso **no se probó**; hay que firmar de nuevo el `.node` y `libduckdb.dylib` con la misma identidad (el módulo publicado trae otra firma) y repetirlo con `signing.mjs --identity`.
2. **El lanzador de Windows es un experimento.** PowerShell + C# compilado en memoria + `icacls`. Escrito y depurado solo contra la CI. No hay prueba con AppLocker/WDAC ni con antivirus de terceros; en una ejecución intermedia de la CI el primer arranque del paquete en Windows tardó 110 s sin el motor confinado (causa no confirmada; en la ejecución final fue 1,1 s).
3. **Conceder permisos en los ancestros es caro.** Dar al AppContainer lectura de las carpetas que preceden a la instalación recorre el volumen: 96 s con `icacls` en `C:\`; 1–6 s por carpeta con subárbol grande al editar el DACL por manejador. Debe hacerse una vez en el instalador, o evitarse instalando bajo `Program Files` (que ya lo concede). Una instalación por usuario (`%LOCALAPPDATA%`) necesita esa preparación.
4. **`sandbox-exec` y `bubblewrap`** dependen de herramientas externas: la primera, obsoleta; la segunda, con la restricción de Ubuntu 24.04. No se probó Landlock ni los perfiles de AppArmor.
5. **Medidas de CI:** una repetición por plataforma, ejecutores compartidos y de distinto rendimiento (macOS Intel es el más lento). Sirven para comparar con/sin capa dentro de la misma ejecución, no como SLA.
6. **La batería de seguridad de M2 no se ejecuta dentro de la capa** (abre un servidor local y crea enlaces simbólicos; la capa lo impide): 10 de 11 comprobaciones en macOS y Windows, 11 de 11 en Linux. Que la capa lo impida es lo deseado, pero esa comprobación concreta no corrió allí.
7. **El sondeo de acceso** cubre seis acciones (lectura de un archivo de usuario y de `hosts` con DuckDB y con Node, TCP y escritura). No es una auditoría del mecanismo: no prueba sockets Unix, tuberías con nombre, memoria compartida, señales ni la exfiltración por canales laterales.
8. **El diseño depende de `RunAsNode`** (§2) y del tiempo máximo de arranque.

## 8. Cómo reproducirlo

```bash
# CI (las cuatro plataformas): el flujo M3 se ejecuta en cualquier PR que toque experiments/duckdb-isolation/** .
# Local (macOS o Linux; en Windows hacen falta derechos para icacls):
node experiments/duckdb-isolation/ci/stage-app.mjs --out "$TMP/m3app" --duckdb 2.0.0-r.1 \
  --electron-dist node_modules/electron/dist --electron-version "$(node -p "require('electron/package.json').version")"
node experiments/duckdb-isolation/isolation.mjs --runtime node --install "$TMP/m3app" --work "$TMP/w1" --out "$TMP/isolation.json"
node experiments/duckdb-isolation/integration.mjs --runtime electron --install "$TMP/m3app" --work "$TMP/w2" --out "$TMP/integration.json"
node experiments/duckdb-isolation/ci/run-electron.mjs --exe dev --install "$TMP/m3app" --work "$TMP/w3" --out "$TMP/main.json"
node experiments/duckdb-isolation/schema-parallel.mjs --install "$TMP/m3app" --work "$TMP/w4" --out "$TMP/schema.json"
npx electron-builder --dir --projectDir "$TMP/m3app" --config "$TMP/m3app/electron-builder.json"
node experiments/duckdb-isolation/signing.mjs --app <aplicación empaquetada> --exe <ejecutable> --work "$TMP/w5" --out "$TMP/signing.json"   # añade --identity "Developer ID Application: …" cuando exista
node experiments/duckdb-isolation/installers.mjs --app "$TMP/m3app" --work "$TMP/w6" --out "$TMP/installers.json"
node experiments/duckdb-isolation/ci/aggregate.mjs <carpeta con los artefactos descargados>
```

Atención en macOS: las variantes de `signing.mjs` con runtime reforzado y sin `disable-library-validation` **hacen que macOS 27 muestre un informe de fallo** (esperado). Ejecútalas en la CI.
