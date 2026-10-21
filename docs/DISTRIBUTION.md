# Distribución de la alfa

## Objetivos

| Sistema | Arquitectura | Artefactos |
|---|---|---|
| macOS 14+ | arm64 e x64 | DMG |
| Windows 11 | x64 | instalador NSIS |
| Ubuntu 24.04 | x64 | AppImage y DEB |

Sin certificados comerciales ni notarización en esta alfa. Los usuarios pueden recibir advertencias del sistema. No indicar que se desactiven protecciones globales; documentar el origen y las limitaciones del paquete. No hay actualizador automático.

## Tres comprobaciones distintas

1. **Construcción:** generar el paquete, comprobar que incluye avisos y recursos, calcular SHA-256.
2. **Ejecución empaquetada:** ejecutar la aplicación extraída/instalada, con un perfil nuevo, y repetir los smoke tests de apertura, edición y exportación.
3. **Instalación:** instalar o extraer el formato entregado mediante su mecanismo normal y comprobar apertura y desinstalación/limpieza en un entorno de prueba. El CI automatizado no demuestra por sí solo la experiencia Gatekeeper/SmartScreen de un equipo de usuario.

El workflow CI construye y prueba la app. El workflow de candidatos produce artefactos, verifica extracción/instalación y ejecuta los smoke tests sobre la aplicación empaquetada. Debe revisarse su salida antes de publicar.

## Procedimiento de release

1. Integrar todos los cambios y verificar el SHA exacto de `main`.
2. Ejecutar **Release candidate** para ese SHA. Descargar los artefactos y las evidencias de sus jobs.
3. Completar `docs/evidence/RELEASE-CHECKLIST.md` con URLs, SHA, resultados, advertencias y limitaciones. Ejecutar las comprobaciones manuales de usuario donde las pruebas CI no cubran firma/cuarentena o integración del escritorio.
4. Si falta un gate, mantener el candidato sin publicar. No reemplazar el gate por un build local de otra revisión.
5. Crear etiqueta `v0.1.0-alpha.1` apuntando al SHA comprobado. Crear una prerelease inicialmente en borrador, adjuntar los artefactos exactos y sus SHA-256.
6. Revisar la correspondencia entre etiqueta, commit, evidencia y archivos. Publicar la prerelease únicamente después del cierre del checklist.

No publicar automáticamente desde PR ni desde un job que solo haya compilado. Los secretos y certificados no se añaden al repositorio.
