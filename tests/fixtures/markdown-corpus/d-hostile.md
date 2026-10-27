# Contenido no confiable

<script>window.__md002Injected = true</script>

<!-- <details><summary>Resumen falso dentro de comentario</summary><script>window.__md002Comment = true</script></details> -->

<details onclick="window.__md002Click = true">
<summary>Resumen tras apertura con atributo prohibido</summary>

Texto seguro después de una apertura con atributo prohibido.

</details>

<details>
<summary>Resumen seguro<img src=x onerror="window.__md002Image = true"></summary>

Texto seguro después de una imagen HTML no confiable.

</details>

<details open="javascript:">
<summary>Apertura con valor de open no permitido</summary>

Texto seguro después de un valor de open no permitido.

</details>

</details>

Texto después de un cierre sin pareja.

<details>

Texto después de una apertura sin pareja al final del documento.
