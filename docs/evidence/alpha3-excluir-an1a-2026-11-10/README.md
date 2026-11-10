# Alpha.3: excluir AN-1a

El propietario decidió mantener el alcance de alpha.3 y preparar la reversión de AN-1a (#155). No se fusiona ni publica desde esta tarea. Las ramas de proyectos y la historia AN-1 se conservan para después de la publicación.

## Alcance y comprobación antes/después

Base: `beccf8bf8698d01f31363e20942ed8630c0d6a21`, merge de #155. Su primer padre es `f949c22725e9371a2dd887685d974f040a885eda`, que ya contiene el guardado #146, H15-2b #151, CI-3c #150 y la versión alpha.3.

Se aplica exclusivamente `git revert --no-commit -m 1 beccf8bf8698d01f31363e20942ed8630c0d6a21`. No se reimplementa ningún comportamiento. La reversión retira los cambios y las pruebas propias de AN-1a; no cambia la cobertura del código anterior a esa entrega.

| Comprobación de alcance | Antes | Después |
|---|---|---|
| `git diff --exit-code --stat f949c22 -- src tests scripts .github package.json package-lock.json` | Salida 1: 18 rutas diferentes ([rojo](alcance-rojo.log)) | Salida 0: ninguna diferencia ([verde](alcance-verde.log)) |
| Árbol completo antes de añadir esta evidencia | Diferente del primer padre | `29be19014ef92e71059aad22e8cd1bd6d0c67e5a`, idéntico al primer padre |

Esta comprobación roja verifica el alcance de la reversión; no se presenta como una nueva prueba funcional del producto. Tras añadir esta carpeta, las únicas diferencias frente a `f949c22` son esta documentación.

## Validación local

macOS Apple silicon, Node.js 24. Se reutilizaron las dependencias locales. El código probado es idéntico al del commit de este PR; solo se añadió esta evidencia después de las comprobaciones.

| Comando | Resultado |
|---|---|
| `npm run check` | 0 errores, 0 avisos ([salida](check.log)) |
| `npm test` | 136 archivos aprobados; 2.649 pruebas aprobadas y una omitida ([salida](unit.log)). La omisión es la prueba HTTP de Pandoc: el binario local 3.12.1 no admite HTTP. |
| `npm run test:e2e` | Incluye `npm run build` y la suite completa. El resultado final se registra en la conversación del PR, manteniendo congelado su SHA durante la CI. |

La CI debe evaluar el head nuevo. El verde de otro commit no se transfiere. Los resultados por plataforma y la suite local completa se registran en el PR para evitar cambiar el head solo por documentación de estado.

## Pendiente y no verificado

- La reversión todavía requiere revisión y fusión por el propietario.
- Las notas finales de alpha.3 están en #159. Esta reversión no las modifica.
- El candidato solo puede ejecutarse sobre el SHA exacto de `main` que cumpla el alcance aprobado y tenga CI verde.
- No se generaron instaladores en esta tarea ni se comprobó Gatekeeper, SmartScreen, FUSE o la integración del escritorio.
- No se creó etiqueta, release ni se actualizó la app instalada. La futura reintroducción de AN-1a necesitará un cambio explícito; sus commits siguen en Git.
