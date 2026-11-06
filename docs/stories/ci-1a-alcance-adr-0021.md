# CI-1a · Alcance y ADR 0021

Base analizada `ed3847976826aa174e09d4e6cfbae201b4e3b19e`. Entrega de medición y selector local de áreas. [Historia original](historia-ci1-pruebas-por-area-diseno-para-codex.md)

## Siete respuestas

1. **Herramienta existente.** Git enumera rutas y Playwright ya agrupa los specs en `shell`, `md` y `csv`. GitHub Actions conserva los tiempos por fase y su log contiene los casos por proyecto. La clasificación de archivos de producto por riesgo pertenece al repositorio.
2. **Skill reutilizable.** Ponytail mantiene una lista explícita de excepciones y una salida completa por defecto. TDD prueba el resultado público del selector y su lectura de rutas.
3. **Integración.** Git y Node 24 se conectan por entrada estándar delimitada por NUL. El selector emite JSON por stdout. `gh` se usa solo para leer resultados históricos.
4. **Madurez, seguridad, mantenimiento y licencia.** Se usan las versiones de Node, Git y Playwright ya previstas por el repositorio. No se incorpora una acción externa ni se cambian dependencias, licencias, secretos o permisos. Las rutas son datos y el selector no las ejecuta.
5. **Costo de mantenimiento.** Revisar las excepciones cuando cambien consumidores, grupos o fixtures. Las rutas nuevas conservan cobertura completa hasta ser clasificadas. Los grupos de specs se importan desde Playwright para evitar otra lista.
6. **Pegamento mínimo.** Una lista explícita de rutas verificadas, un plan JSON y dos entradas locales, argumentos y flujo Git delimitado por NUL. Las unitarias verifican la clasificación y el contrato de salida.
7. **Valor del código propio.** Expresa qué es compartido en FreyaLab y hace revisable la decisión de reducir E2E. El cálculo de cambios, la ejecución de pruebas y los registros siguen en las herramientas que ya los resuelven.

CI-1b y CI-1c quedan fuera de esta entrega. Las observaciones de tiempos no cambian todavía ningún gate.
