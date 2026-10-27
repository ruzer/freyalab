---
title: Guía completa
tags: [prueba, documentación]
author: Equipo de prueba
---

# Guía completa

Una guía con propiedades, [navegación al apéndice](#apendice), [café codificado](#caf%C3%A9) y una [sección pendiente](#pendiente).

La información tiene una nota[^1] y se vuelve a citar[^1]. Otra nota conserva el mismo texto[^2].

<details><summary>Información adicional</summary>

## Apéndice

El contenido del apéndice debe verse al imprimir aunque el plegable esté cerrado.

| Tipo | Contenido |
| --- | --- |
| Enlace válido | [Guía](#guia-completa) |
| Enlace ausente | [Pendiente](#pendiente) |

<details open>
<summary>Código y tabla</summary>

```javascript
const ejemplo = "<details> no es una etiqueta fuera del código";
console.log(ejemplo);
```

Texto conservado del segundo nivel.

</details>

</details>

## Café

Una sección fuera del plegable.

[^1]: Texto de la nota. [Apéndice](#apendice).

[^2]: Texto de la nota.
