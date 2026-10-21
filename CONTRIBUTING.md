# Contribuir

Usa Node.js 24 LTS y `npm ci`. Lee `AGENTS.md`, `docs/PLAN.md` y el render de referencia antes de cambiar la interfaz.

1. Crea una rama `codex/<cambio>` desde `main` actualizado.
2. Mantén el cambio pequeño y enlaza la entrega del plan que resuelve.
3. Añade pruebas que comprueben el comportamiento: especialmente persistencia, CSV, IPC y exportación. Usa datos sintéticos; no publiques documentos privados.
4. Ejecuta `npm run check`, `npm test`, `npm run test:e2e` y `npm run build`. Documenta la plataforma, comandos y resultados. No repitas suites ya verificadas por CI sin un cambio que lo justifique.
5. Abre un PR describiendo problema, resultado y comprobaciones. Conserva la referencia visual; explica cualquier diferencia.

La CI obligatoria debe pasar sobre el commit que se integra. Que compile no demuestra que el paquete abra ni que su instalador funcione. Si una comprobación no está disponible, indícalo; no la marques como aprobada. Una CI obligatoria ausente bloquea la publicación.

No añadas funciones fuera de la alfa, dependencias grandes, ejecución de contenido de documentos ni acceso genérico al sistema desde la interfaz. Las modificaciones deben preservar los valores de CSV y permitir recuperar el trabajo ante errores de guardado.

No se requieren cesiones de copyright. Al contribuir aceptas distribuir tu contribución bajo la licencia MIT de este repositorio. Los avisos de terceros no se eliminan.
