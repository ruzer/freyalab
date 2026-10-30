# ED-01 · Posiciones secundarias al quitar formato

La revisión estática focal detectó un fallo real del adaptador. En `**Freya Luna**`, con los cursores en 3 y 9, quitar negrita conservaba el texto `Freya Luna`, pero el segundo cursor saltaba a 0 en vez de 7. El comando puro describe un reemplazo del tramo completo; CodeMirror no sabe que su contenido interior se conserva.

La corrección `6babfd8d80439ef3faccb0b1c9f2a4f0ddd151f3` cambia únicamente `markdownFormatChange`: si un tramo contiene literalmente al otro en una ubicación **inequívoca**, expresa la envoltura como inserciones/eliminaciones de prefijo y sufijo. CodeMirror sigue construyendo los cambios y mapeando los rangos; la selección principal conserva el resultado del comando. Todo se aplica mediante la misma transacción. No se añadió un motor de diferencias ni se reescribieron los comandos puros.

Los casos vacíos conservan su tratamiento normal y un reemplazo idéntico no crea una edición. Cuando hay varias ocurrencias —por ejemplo, la etiqueta de un enlace también aparece en su URL— no se adivina cuál conservar: se mantiene el mapeo nativo anterior. Esa situación puede colapsar posiciones secundarias; no se promete una correspondencia semántica para reemplazos ambiguos o cambios que no sean envolturas exactas.

## Resultados ejecutados

| Comprobación | Resultado real |
|---|---|
| Nuevos casos sobre el adaptador anterior | **8 fallan / 14 pasan**, 22 ejecutados: negrita, cursiva, tachado, código, enlace, Unicode, dirección invertida y principal posterior. |
| Guardia adicional antes de corregir la ambigüedad | **1 falla / 23 pasan**, 24 ejecutados: el primer intento elegía la etiqueta repetida dentro de la URL. El caso de identidad ya pasaba; no se presenta como una prueba roja. |
| Adaptador final y regresiones focales | **196/196**, cuatro archivos, incluidos los 146 casos de comandos puros sin modificar. El archivo de mapeo contiene 24 casos. |
| `npm run check` | Código 0; Svelte **0 errores / 0 avisos** y tsc correcto. |
| Build previo a Native | Código 0, **1,69 s** de reloj; out propio con la corrección. |
| Flujo E4 de interfaz existente, ampliado | **1/1**, 1,8 s, sin reintentos: quitar negrita, escribir en las dos posiciones correctas, deshacer la escritura, deshacer el formato y rehacerlo. El archivo de disco permanece intacto. |
| `npm test` completo con la fuente congelada | **1491/1491**, 76 archivos, 13,06 s; incluye CSV. El Pandoc local 3.12.1 informa que no soporta HTTP, por lo que no acredita aquí la eficacia de ese sandbox. |

El flujo E2E utiliza el rehacer nativo de cada plataforma (`Meta+Shift+Z` en macOS, `Control+Y` en Windows/Linux). Las identidades E2E siguen siendo 439; no se añadió otro caso para repetir el flujo existente. Los resultados Windows/Linux dependen de la CI nueva; el foco local se ejecutó en macOS Apple silicon.

Logs originales conservados en `recovery/ed01`: `secondary-format-red.log`, `secondary-format-ambiguity-red.log`, `secondary-format-green.log`, `secondary-format-native.log`, `main-a44-secondary-check.log`, `main-a44-secondary-build.log` y `main-a44-secondary-unit.log`. El snapshot previo al cierre integral contiene 505 huellas. El cierre completo y su medición final se registran en el documento de integración; mientras no terminen, este foco no los sustituye.

No se modificaron package/lock, comandos puros, IPC, guardado ni CSV; tampoco `.txt`, Mermaid, el renderizador o la configuración de seguridad. No acredita lector de pantalla físico ni composición IME real.
