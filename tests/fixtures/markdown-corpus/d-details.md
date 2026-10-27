# Plegables

[Ir al título interior](#dentro-del-plegable).

<details><summary>Primer nivel</summary>

Texto con **negrita**, una lista y un título.

## Dentro del plegable

- Primer elemento.
- Segundo elemento.

<details open>
<summary>Segundo nivel</summary>

| Columna | Valor |
| --- | --- |
| Estado | Disponible |

<details>
<summary>Tercer nivel</summary>

```typescript
const cierreLiteral = "</details>";
console.log(cierreLiteral);
```

Contenido del tercer nivel.

</details>

</details>

</details>

<details>

Este plegable no declara summary y su contenido sigue presente.

</details>

- Entrada de lista.

  <details>
  <summary>Más en lista</summary>

  Contenido del plegable dentro de la lista.

  </details>

> <details>
> <summary>Más en cita</summary>
>
> Contenido del plegable dentro de la cita.
>
> </details>
