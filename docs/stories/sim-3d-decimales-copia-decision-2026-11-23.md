# SIM-3d · Decisión vigente del propietario · 2026-11-23

La sección SIM-3d de la [historia actualizada](historia-sim3-resultados-correctos-diseno-para-codex.md) sustituye las decisiones anteriores «2/Todos» y «copia hasta15significativas». #214 fusionó solo documentación; el código continúa en un nuevo borrador sobre main, sin repetir 3a ni3c.

- Un ajuste global: `decimalesAnalisis: 'auto' | 'all'`, inicial `auto`, persistido como Tema. Selector «Automático / Más precisión» en Análisis y la misma preferencia en Ajustes/Apariencia.
- Automático: conteos enteros; resultados generales/porcentajes hasta2decimales; Pearson/R² hasta3; pequeños no nulos hasta2cifras significativas. Si el redondeo presenta falsos0, ±1 en coeficientes o100% en porcentajes, se aumenta la precisión hasta distinguirlos.
- Más precisión: hasta15cifras significativas; es una presentación, no «todos los dígitos».
- Copia y ayuda: `String(value)` del resultado del motor, con unidad; no pasan por el redondeo visual. Si una selección parcial toca un número se copia completo. Se conservan texto, IDs, selección inversa y separadores nativos. Es una decisión explícita del propietario, diferente de copiar solo texto visible.
- Se aplica a Información, Estadísticas principales y Más estadísticas, y a tabla/texto de tendencia de Gráficos. El dibujo usa los datos completos; no se cambian ejes, consultas, exportaciones CSV/JSON ni informes Markdown.
- No se añaden controles por columna, formatos fijos2/3/4, dependencias ni otro almacén de preferencias. No se modifica la tabla CSV.

Las evidencias antiguas2/Todos permanecen históricas; no acreditan el contrato nuevo. Se requiere rojo→verde y comprobaciones nativas de la nueva preferencia, extremos, copia, informes, exportaciones y persistencia. La guarda de extremos es del modo Automático; Más precisión conserva su tope explícito de15cifras.

## Aclaración posterior: exportaciones estadísticas

El propietario autorizó añadir CSV/JSON a Estadísticas dentro de3d. Se amplía solo la operación segura de exportar resultados; se reutiliza exportResult y se conservan Markdown y las exportaciones de Gráficos. Ver alcance/ADR para validación, muestras y escritura. La afirmación anterior «sin IPC nuevo» se limitaba al formato/copia; esta ampliación añade una petición específica, nunca escritura genérica.
