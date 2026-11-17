# PRJ-02a · Aclaraciones aprobadas el 2026-11-16

Este documento complementa la historia de Claude sin modificar su copia original. La semántica matemática y sus vectores se registraron en el primer commit, antes del ejecutor.

1. **Primeras N sin orden previo.** Se lee solo el prefijo necesario. La cobertura es parcial y no se afirma que esa ejecución haya verificado el SHA-256 completo. Leer por adelantado un bloque de bytes no equivale a haber examinado todos sus registros.
2. **Orden completo y depósito aleatorio.** Se rechazan las combinaciones que necesiten materializar un orden ilimitado antes de elegir una muestra exacta. El mensaje explica que primero hay que acotar las filas. No se intercambian esos pasos. Orden y primeras N, o una vista previa final de cien filas, conservan memoria proporcional a N.
3. **Proyectos futuros.** Solo se pueden probar definiciones guardadas cuyas cadenas se validen íntegramente como semántica 1. Lo desconocido se conserva en los bytes originales, sin ejecutarlo ni escribirlo. La excepción no permite crear instrucciones nuevas ni degradar versiones desconocidas a la v1.
4. **Texto reproducible.** Se fija un orden Unicode ordinal independiente del equipo. El contrato v1 compara unidades UTF-16, sin colación regional ni normalización. Puede diferir del orden alfabético habitual; el comportamiento interactivo de la tabla no cambia.
5. **Probar desde Proyecto sin abrir la tabla.** El propietario eligió esta ubicación al comprobar que abrir una fuente grande indexaba el archivo completo antes de mostrar el panel. «Nuevo conjunto…» y «Abrir» un conjunto desde Proyecto usan el mismo editor, sin abrir el CSV como documento ni crear un índice. «Guardar como conjunto…» sigue dentro de una tabla que ya está abierta. Así la ruta de primeras N no necesita una pasada integral previa.

No se autorizan en esta entrega análisis de conjuntos, exportaciones, archivos intermedios, cachés de resultados, nuevas dependencias ni ampliaciones de los límites analíticos.
