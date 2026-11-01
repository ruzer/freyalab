# SEG-S5a · Diferido a historia propia

El propietario aprobó diferir la recuperación del motor Mermaid a una historia propia. No se implementa un timeout, prototipo ni aislamiento en S5b.

Se conservan el parche propuesto de pruebas con un mock de cola interna fiel a Mermaid12.2.0 y la salida roja real: tres pruebas propuestas fallaron por estado pendiente tras30s falsos o por siguiente render retenido; los tres oráculos A0 existentes pasaron (354ms, exit1). No fueron plazos de pared ni errores del runner.

`tests/diagram-concurrency.test.ts` se restauró byte por byte a HEAD9c84642a2e7e8bc033133c56b9bb880372772f2c; sus tres pruebas A0 permanecen intactas. El parche no se incorpora a la suite activa, porque el producto de recuperación no está autorizado en este bloque. Esto documenta un criterio diferido, no un verde de recuperación ni una eliminación silenciosa de cobertura existente.

La historia propia deberá decidir cancelación/aislamiento real: terminar la espera externa no libera la cola interna de Mermaid y no puede permitir que una inicialización nueva compita con un trabajo antiguo.
