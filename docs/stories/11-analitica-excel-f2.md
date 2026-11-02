OBJETIVO · FreyaLab · Historia 11 · F2: tabla dinámica + gráfico (modelo Excel)

Por qué: el propietario conoce las tablas dinámicas de Excel y encuentra el panel Gráficos actual (formulario de 6 filas, 5 párrafos de texto, gráfico fuera de vista a 1280×720) confuso y poco intuitivo. Modelo objetivo: el de Excel.

Comportamiento (esto es el contrato; tú decides la estructura del código)
1. Lista de campos con insignia de tipo y cuatro zonas: Filas, Columnas, Valores, Filtros. Añadir un campo = arrastrar o, equivalentemente, clic/menú «Añadir a…» y teclado (obligatorio; se anuncia con aria-live).
2. Valores con «Resumir por»: Suma, Cuenta, Promedio, Mín., Máx., Mediana (los cálculos que ya soporta chartSQL; nombres de persona, es/en).
3. El resultado se actualiza solo (vista previa inmediata) y se muestra como tabla dinámica y como gráfico a la vez. El tipo de gráfico lo propone suggest() (F1) con el motivo en una línea; cambiarlo es un clic.
4. El gráfico/tabla ocupa el área principal (no una franja bajo un formulario); a 1280×720 se ve completo sin desplazarse. Ventana estrecha: pantalla completa con «Volver a la tabla» visible arriba.
5. Los controles actuales no se eliminan: pasan a «Más opciones». El SQL generado se ofrece como «Ver consulta». Los párrafos de ayuda/estado se reducen a un icono de información y una línea de estado accesible.
6. Montos y porcentajes ($1,200.50, 10%): explicar en pantalla por qué no se suman y ofrecer convertirlos de forma explícita. Botón para intercambiar filas y columnas.

Límites
- Mismo motor: el resultado debe ser idéntico al del formulario actual con las mismas opciones (prueba de equivalencia sobre chartSQL). Sin dependencias nuevas (ADR 0021; el arrastre usa Pointer Events). Sin red. Límites, cancelación, exportación SVG/PNG/PDF y tabla accesible intactos. Teclado, es/en, claro/oscuro.

Proceso
- Usa de verdad las skills que tengas de diseño UX/UI, visualización de datos (valida la paleta de series con el validador de color), accesibilidad, TDD y ponytail; si alguna no existe, dilo en el informe.
- Entregas, cada una en borrador, base main, la prueba falla primero:
  F2-0: antes de código de interfaz, un boceto estático (HTML o capturas) de la pantalla en 1440×900 y 1280×720, claro y oscuro, para mi aprobación. DETENTE.
  F2a: disposición con el resultado primero, vista previa inmediata y menos texto.
  F2b: lista de campos y zonas (clic/teclado), «Resumir por», sugerencia de gráfico.
  F2c: arrastrar y soltar sobre las mismas acciones.
  Tras cada entrega, informe con capturas antes/después y DETENTE. No fusiones.
