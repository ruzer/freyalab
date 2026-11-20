# Umbral D · fallo de preparación observado

Base `67e0bf7a469990fc26d7c0bf22d63c422c4455d1`; spec`baf9815aceb84e4491cb54e2d47ec387daae3fb88ce773f26a840768267217c0`. No es un sexto rojo de conducta.

El caso falla en el primer archivo de20columnas. La traza conserva Welcome sinmodal23559.486ms y NuevoProyecto ya abierto sobreWelcome23694.446ms. El CSV aparece después detrás del modal. openPaths retornó suIDcorrecto23741.954ms y la grilla alcanzó2filas23961.512ms; el primer clicAnalizar23980.254ms fue interceptado. No hay clic o tecla de prueba anterior en la traza.

El origen del abridor no está demostrado; la traza de Playwright no excluye entrada nativa ajena a su canal. Esperar identidad/filas, ya satisfechas, no explica esa apertura. No se aplicó Cancel/Escape, espera, cambio de plazos, parche de setup ni producto.

Siguiente paso mínimo propuesto: raíz ejecuta el mismo caso aislado sobre el builddebase preservado; si vuelve el modal, capturar su comando/clic de apertura en sonda privada de bootstrap. Los5rojos de presentación se conservan por separado.

Hashes y cronología exacta en `observation.json`.
