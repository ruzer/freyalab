# Comparación de subfases: antes y después

Antes: run 43550207123, SHA `3fadd6ac5fc134b077c6ecaa94afffc09510f680`. Después: run 43552650063, SHA `070994ef8421d34d0d3dd75d7c011202a724e6b4`.

Tiempos en milisegundos: mediana [mínimo–máximo] de tres observaciones independientes por caso/contexto/arquitectura. Se suman las operaciones de una observación antes de calcular la mediana. Las fases que no se ejecutan se muestran con —, nunca como cero medido.

## arm64 · development · Constructor: operaciones y cambios de alcance completos

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "arm64", "os": "24.6.0", "cpu": "Apple M1 (Virtual)", "logicalCpus": 3, "totalMemoryBytes": 7516192768, "node": "24.22.2", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [14, 14, 14] → [14, 14, 14]. SQL de warmup/oráculo separados: [8, 8, 8] → [8, 8, 8]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 9294.17 [9293.54–11911.40] | 13752.47 [13518.74–14263.17] |
| SQL window | 1352.58 [1298.50–1689.27] | 2009.67 [1902.54–2166.66] |
| SQL engine | 7995.04 [7941.59–10222.13] | 11742.79 [11616.20–12096.51] |
| SQL sourceStart | 4.54 [3.85–5.54] | 12.53 [11.05–16.58] |
| SQL sourceRead | 17.49 [16.55–27.49] | 28.56 [24.36–30.13] |
| SQL sourceEncode | 0.28 [0.23–0.30] | 0.42 [0.30–0.51] |
| SQL sourceAppend | 259.23 [249.71–379.81] | 376.61 [368.19–403.59] |
| SQL sourceLoad | 518.86 [504.62–729.06] | 843.76 [794.59–852.76] |
| SQL seal | 23.53 [22.43–37.64] | 34.82 [28.58–44.53] |
| SQL query | 909.00 [896.10–1156.50] | 1400.80 [1341.90–1415.60] |
| SQL materialize | 2.70 [2.30–2.90] | 3.80 [3.30–5.10] |
| SQL resultTransfer | 7.20 [7.13–9.24] | 9.85 [9.67–10.88] |
| SQL waiting | 0.12 [0.11–0.14] | 0.20 [0.19–0.28] |
| SQL total | 10809.71 [10775.23–13921.86] | 16179.29 [15833.51–16586.75] |
| UI profiles | 42.90 [16.20–52.80] | 57.80 [52.60–78.10] |
| UI chartRows | 0.80 [0.50–1.20] | 0.90 [0.90–1.00] |
| UI chartOptions | 17.50 [15.80–17.60] | 29.00 [23.20–30.60] |
| UI chartSetOption | 53.30 [48.10–57.80] | 88.10 [74.60–96.30] |
| UI chartRendered | 70.80 [63.90–75.30] | 117.20 [105.40–119.30] |
| UI chartPainted | 157.50 [131.10–174.30] | 191.70 [177.90–192.60] |

| Perfiles | Antes | Después |
| --- | ---: | ---: |
| Llamadas por observación | [7, 7, 7] | [7, 7, 7] |
| profilesRoundtripMs | 41.60 [15.30–50.40] | 55.70 [49.80–75.90] |
| profilesMainHandlerMs | 12.33 [9.71–19.95] | 21.76 [12.77–36.35] |
| profilesOuterMs | 29.27 [5.59–30.45] | 39.55 [28.04–42.93] |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:plots.csv | 349.30 [310.06–363.03] | 469.38 [429.59–573.25] |
| oracle:count | 1133.44 [1083.10–1585.00] | 1769.68 [1449.73–1917.08] |
| oracle:distinct | 1050.04 [898.69–1446.57] | 1366.90 [1193.61–1395.90] |
| oracle:sum | 1030.31 [732.85–1098.64] | 1195.48 [1098.79–1663.86] |
| oracle:average | 954.41 [766.17–999.33] | 1249.68 [1166.39–1512.97] |
| oracle:min | 763.57 [702.44–799.11] | 1379.80 [1283.03–1698.99] |
| oracle:max | 713.80 [696.35–732.39] | 1250.00 [1248.18–1434.56] |
| oracle:median | 766.09 [716.18–883.37] | 1330.76 [1065.36–1363.40] |
| open:ids.csv | 75.22 [66.71–98.46] | 180.53 [118.78–181.62] |
| ids:distinct | 885.33 [824.76–886.47] | 1317.33 [1063.45–1416.40] |
| ids:chart | 4715.47 [4615.16–4813.43] | 6299.46 [6048.45–6450.79] |
| filtered-A:chart | 2021.56 [2012.98–2057.10] | 2667.94 [2645.40–3069.88] |
| filtered-B:chart | 2032.97 [2000.16–2475.86] | 2596.70 [2472.83–3014.87] |
| all:chart | 1949.96 [1932.31–2477.53] | 3027.54 [2499.26–3132.45] |
| number-again:chart | 1973.10 [1938.23–3023.17] | 2982.84 [2486.01–3016.96] |

## arm64 · development · F2b: perfiles y dibujo con 200 campos

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "arm64", "os": "24.6.0", "cpu": "Apple M1 (Virtual)", "logicalCpus": 3, "totalMemoryBytes": 7516192768, "node": "24.22.2", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [2, 2, 2] → [2, 2, 2]. SQL de warmup/oráculo separados: [2, 2, 2] → [2, 2, 2]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 1442.64 [1346.76–2418.57] | 1834.60 [1804.90–2525.55] |
| SQL window | 276.71 [191.79–373.37] | 327.20 [310.66–419.52] |
| SQL engine | 1165.93 [1154.97–2045.20] | 1507.41 [1494.24–2106.03] |
| SQL sourceStart | 0.81 [0.68–0.89] | 1.01 [0.94–1.77] |
| SQL sourceRead | 19.09 [14.43–28.68] | 22.55 [15.86–40.24] |
| SQL sourceEncode | 0.27 [0.09–0.32] | 0.12 [0.11–0.23] |
| SQL sourceAppend | 81.60 [67.59–106.59] | 129.79 [95.29–139.30] |
| SQL sourceLoad | 144.67 [121.30–216.28] | 239.66 [182.25–267.06] |
| SQL seal | 3.99 [2.77–4.71] | 6.64 [6.21–9.01] |
| SQL query | 149.90 [135.10–213.40] | 208.10 [189.20–241.60] |
| SQL materialize | 0.40 [0.30–0.40] | 0.30 [0.20–0.50] |
| SQL resultTransfer | 1.27 [0.93–1.28] | 1.45 [1.21–2.72] |
| SQL waiting | 0.06 [0.05–0.06] | 0.10 [0.09–0.10] |
| SQL total | 1749.87 [1613.42–2866.85] | 2336.41 [2212.93–3017.28] |
| UI profiles | 3206.10 [3188.30–3671.50] | 408.90 [388.80–456.70] |
| UI chartRows | 0.10 [0.00–0.20] | 0.20 [0.10–0.50] |
| UI chartOptions | 14.80 [13.10–22.30] | 20.60 [18.60–25.00] |
| UI chartSetOption | 3.60 [3.10–7.60] | 5.20 [4.10–9.50] |
| UI chartRendered | 18.30 [16.30–30.10] | 28.30 [25.90–29.10] |
| UI chartPainted | 23.10 [21.00–41.40] | 33.70 [30.60–36.30] |

| Perfiles | Antes | Después |
| --- | ---: | ---: |
| Llamadas por observación | [200, 200, 200] | [200, 200, 200] |
| profilesRoundtripMs | 3175.30 [3153.50–3635.00] | 377.70 [362.30–432.30] |
| profilesMainHandlerMs | 191.14 [182.15–277.50] | 182.59 [177.80–225.38] |
| profilesOuterMs | 2984.16 [2971.35–3357.50] | 199.90 [179.71–206.92] |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:ventas.csv | 676.97 [375.00–2231.60] | 463.21 [368.92–3225.98] |
| warmup:chart | 3700.69 [3183.47–4201.18] | 4567.57 [4411.47–4716.51] |
| open:campos.csv | 114.94 [82.87–115.73] | 121.22 [115.62–150.07] |
| 200-fields:profiles-to-visible | 6015.32 [5999.00–7715.96] | 4183.84 [3717.45–4250.62] |

## arm64 · development · SQL: carga y resultados con más de 50 MiB

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "arm64", "os": "24.6.0", "cpu": "Apple M1 (Virtual)", "logicalCpus": 3, "totalMemoryBytes": 7516192768, "node": "24.22.2", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [1, 1, 1] → [1, 1, 1]. SQL de warmup/oráculo separados: [0, 0, 0] → [0, 0, 0]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 831.59 [698.94–1286.35] | 1296.13 [1009.14–1586.45] |
| SQL window | 171.45 [104.99–181.32] | 194.92 [171.35–226.68] |
| SQL engine | 650.27 [593.95–1114.90] | 1069.45 [814.22–1415.11] |
| SQL sourceStart | 1.13 [0.89–1.81] | 4.77 [0.82–5.28] |
| SQL sourceRead | 1222.31 [1154.13–2167.08] | 1967.49 [1880.38–2051.85] |
| SQL sourceEncode | 36.14 [34.74–52.51] | 45.97 [45.58–69.13] |
| SQL sourceAppend | 3331.56 [3243.70–5342.68] | 831.96 [765.02–923.08] |
| SQL sourceLoad | 4608.78 [4456.73–7614.75] | 2984.15 [2717.83–3053.34] |
| SQL seal | 1.88 [1.79–4.11] | 3.55 [2.05–4.31] |
| SQL query | 46.80 [21.50–59.90] | 42.50 [33.40–47.90] |
| SQL materialize | 0.40 [0.00–0.50] | 0.30 [0.20–0.50] |
| SQL resultTransfer | 1.02 [0.47–1.45] | 0.84 [0.80–0.94] |
| SQL waiting | 0.16 [0.13–0.32] | 0.31 [0.13–0.51] |
| SQL total | 5571.78 [5190.52–9033.49] | 4367.68 [3802.70–4738.52] |
| UI profiles | — | — |
| UI chartRows | — | — |
| UI chartOptions | — | — |
| UI chartSetOption | — | — |
| UI chartRendered | — | — |
| UI chartPainted | — | — |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:fuente-completa.csv | 1060.10 [817.37–1334.87] | 1198.23 [1194.03–1545.79] |
| 50MiB:query-to-visible | 6456.31 [5793.65–9685.28] | 5205.85 [4650.91–5588.10] |

## arm64 · development · TEN-1: consulta y dibujo con 300000 filas reales

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "arm64", "os": "24.6.0", "cpu": "Apple M1 (Virtual)", "logicalCpus": 3, "totalMemoryBytes": 7516192768, "node": "24.22.2", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [2, 2, 2] → [1, 1, 1]. SQL de warmup/oráculo separados: [0, 0, 0] → [0, 0, 0]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 2067.81 [1703.04–2360.31] | 1121.56 [1048.36–1580.42] |
| SQL window | 310.17 [272.21–318.20] | 208.24 [195.96–277.23] |
| SQL engine | 1749.62 [1430.83–2050.14] | 913.32 [852.40–1303.18] |
| SQL sourceStart | 1.86 [1.68–3.41] | 3.29 [1.62–4.83] |
| SQL sourceRead | 3701.27 [3417.26–4241.86] | 2500.74 [2179.94–3082.64] |
| SQL sourceEncode | 26.16 [24.71–28.27] | 20.84 [18.46–29.40] |
| SQL sourceAppend | 3924.53 [3380.11–4191.37] | 1539.94 [1341.50–1871.96] |
| SQL sourceLoad | 7703.72 [6873.07–8539.94] | 4102.34 [3582.36–5043.75] |
| SQL seal | 3.89 [3.50–4.85] | 3.52 [2.20–5.33] |
| SQL query | 457.90 [390.50–597.60] | 633.50 [529.80–752.90] |
| SQL materialize | 53.20 [47.40–56.70] | 116.20 [91.50–125.00] |
| SQL resultTransfer | 4.50 [4.49–7.44] | 9.29 [7.35–13.11] |
| SQL waiting | 0.15 [0.11–0.26] | 0.32 [0.12–0.68] |
| SQL total | 10344.61 [9063.82–11622.18] | 6103.48 [5392.55–7509.92] |
| UI profiles | — | — |
| UI chartRows | 21.00 [14.90–23.50] | 24.20 [23.50–47.20] |
| UI chartOptions | 57.40 [47.60–83.90] | 76.20 [69.40–88.20] |
| UI chartSetOption | 88.50 [87.60–165.90] | 167.00 [142.50–213.00] |
| UI chartRendered | 145.00 [136.10–249.70] | 236.60 [218.70–301.30] |
| UI chartPainted | 182.00 [165.40–283.40] | 270.00 [250.50–340.10] |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:many.csv | 1177.34 [861.63–1369.99] | 1504.98 [1032.68–1661.50] |
| 300000:configure | 515.69 [399.04–682.63] | 699.18 [581.72–767.76] |
| 300000:query-to-visible | 10870.33 [9583.63–12116.57] | 6765.99 [6050.65–8016.24] |

## arm64 · packaged · Constructor: operaciones y cambios de alcance completos

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "arm64", "os": "24.6.0", "cpu": "Apple M1 (Virtual)", "logicalCpus": 3, "totalMemoryBytes": 7516192768, "node": "24.22.2", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [14, 14, 14] → [14, 14, 14]. SQL de warmup/oráculo separados: [8, 8, 8] → [8, 8, 8]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 12324.98 [12206.16–12909.41] | 14555.32 [14358.22–15494.42] |
| SQL window | 1828.50 [1755.91–1896.32] | 2190.47 [2158.96–2610.14] |
| SQL engine | 10496.48 [10309.85–11153.50] | 12364.85 [12199.26–12884.28] |
| SQL sourceStart | 5.35 [4.78–6.32] | 14.98 [12.83–15.06] |
| SQL sourceRead | 24.64 [19.47–25.13] | 31.86 [29.11–35.44] |
| SQL sourceEncode | 0.37 [0.32–0.70] | 0.43 [0.41–1.39] |
| SQL sourceAppend | 347.60 [318.95–376.37] | 386.44 [322.51–405.28] |
| SQL sourceLoad | 709.30 [687.66–727.16] | 917.05 [785.90–917.83] |
| SQL seal | 27.10 [26.10–31.73] | 33.32 [25.76–35.99] |
| SQL query | 1166.90 [1091.20–1313.20] | 1469.50 [1250.90–1484.60] |
| SQL materialize | 3.70 [3.00–3.70] | 3.90 [2.90–4.10] |
| SQL resultTransfer | 9.12 [8.20–10.50] | 12.19 [10.97–12.89] |
| SQL waiting | 0.16 [0.14–0.21] | 0.28 [0.25–1.41] |
| SQL total | 14309.78 [14089.35–15073.30] | 17128.14 [16522.55–18040.09] |
| UI profiles | 60.70 [27.30–71.90] | 48.60 [36.40–66.60] |
| UI chartRows | 1.10 [0.80–1.20] | 1.30 [1.00–2.70] |
| UI chartOptions | 21.70 [17.60–35.50] | 30.80 [24.70–43.00] |
| UI chartSetOption | 61.10 [55.10–68.60] | 100.80 [97.00–104.20] |
| UI chartRendered | 86.60 [76.80–96.60] | 128.10 [126.00–147.70] |
| UI chartPainted | 172.10 [169.40–174.70] | 207.90 [206.70–208.60] |

| Perfiles | Antes | Después |
| --- | ---: | ---: |
| Llamadas por observación | [7, 7, 7] | [7, 7, 7] |
| profilesRoundtripMs | 58.70 [25.70–69.80] | 47.20 [35.20–64.30] |
| profilesMainHandlerMs | 19.96 [15.16–27.07] | 17.43 [15.75–25.88] |
| profilesOuterMs | 31.63 [10.54–49.84] | 31.45 [17.77–38.42] |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:plots.csv | 533.61 [364.72–2422.87] | 447.35 [397.08–2697.50] |
| oracle:count | 1229.90 [1200.49–1365.04] | 1516.26 [1381.30–1566.58] |
| oracle:distinct | 861.65 [831.75–1331.95] | 1110.23 [849.81–1499.22] |
| oracle:sum | 966.18 [899.16–1132.67] | 1149.50 [783.02–1382.42] |
| oracle:average | 949.24 [799.82–982.95] | 999.96 [733.06–1681.65] |
| oracle:min | 1183.28 [766.19–1183.40] | 1201.24 [816.18–1265.98] |
| oracle:max | 949.39 [899.70–1265.42] | 1396.48 [782.88–1483.12] |
| oracle:median | 933.06 [916.68–1282.29] | 1299.57 [815.54–1348.87] |
| open:ids.csv | 100.08 [82.58–147.06] | 97.94 [50.15–110.30] |
| ids:distinct | 951.69 [881.99–1099.72] | 1100.45 [882.11–1855.94] |
| ids:chart | 5947.54 [4733.70–6103.28] | 6727.73 [5200.76–7164.78] |
| filtered-A:chart | 2621.69 [2579.11–2688.13] | 3103.03 [2572.56–3112.13] |
| filtered-B:chart | 2561.32 [2502.50–3018.54] | 3000.34 [2602.86–3008.80] |
| all:chart | 2034.87 [1950.03–2466.24] | 3086.46 [2016.50–3568.00] |
| number-again:chart | 2037.89 [2020.14–2474.01] | 2542.63 [2006.57–3135.17] |

## arm64 · packaged · SQL: carga y resultados con más de 50 MiB

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "arm64", "os": "24.6.0", "cpu": "Apple M1 (Virtual)", "logicalCpus": 3, "totalMemoryBytes": 7516192768, "node": "24.22.2", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [1, 1, 1] → [1, 1, 1]. SQL de warmup/oráculo separados: [0, 0, 0] → [0, 0, 0]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 808.62 [791.53–938.84] | 1414.07 [924.62–1703.85] |
| SQL window | 130.06 [124.81–131.89] | 252.98 [156.73–369.18] |
| SQL engine | 683.81 [661.46–806.95] | 1161.09 [767.88–1334.67] |
| SQL sourceStart | 0.65 [0.61–1.08] | 2.62 [1.12–4.32] |
| SQL sourceRead | 1315.03 [1135.94–1442.92] | 1874.65 [1304.01–2148.43] |
| SQL sourceEncode | 30.15 [28.02–33.48] | 42.06 [24.85–47.60] |
| SQL sourceAppend | 3361.73 [3161.70–3765.30] | 807.40 [502.30–835.44] |
| SQL sourceLoad | 4724.70 [4346.77–5270.76] | 2799.20 [1859.06–3039.90] |
| SQL seal | 2.15 [1.85–2.91] | 2.19 [1.33–2.33] |
| SQL query | 34.20 [25.60–40.70] | 62.30 [35.80–72.00] |
| SQL materialize | 0.30 [0.20–0.30] | 0.20 [0.10–0.40] |
| SQL resultTransfer | 0.67 [0.54–1.30] | 2.12 [0.54–3.05] |
| SQL waiting | 0.15 [0.15–0.77] | 0.16 [0.11–0.18] |
| SQL total | 5601.49 [5343.48–6115.24] | 4353.89 [2836.46–4884.66] |
| UI profiles | — | — |
| UI chartRows | — | — |
| UI chartOptions | — | — |
| UI chartSetOption | — | — |
| UI chartRendered | — | — |
| UI chartPainted | — | — |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:fuente-completa.csv | 1142.92 [864.49–1297.19] | 1225.30 [841.85–1416.63] |
| 50MiB:query-to-visible | 6461.98 [5864.76–6845.00] | 5386.71 [3431.60–5828.64] |

## x64 · development · Constructor: operaciones y cambios de alcance completos

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "x64", "os": "24.6.0", "cpu": "Intel(R) Core(TM) i7-8700B CPU @ 3.20GHz", "logicalCpus": 4, "totalMemoryBytes": 15032385536, "node": "24.19.0", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [14, 14, 14] → [14, 14, 14]. SQL de warmup/oráculo separados: [8, 8, 8] → [8, 8, 8]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 32281.33 [31092.70–33196.19] | 25861.59 [21362.13–35814.93] |
| SQL window | 5130.06 [4909.49–5246.68] | 3742.43 [3517.81–5668.32] |
| SQL engine | 27151.27 [26183.21–27949.51] | 22119.16 [17844.32–30146.61] |
| SQL sourceStart | 9.04 [8.77–9.25] | 12.08 [11.03–17.56] |
| SQL sourceRead | 46.97 [43.97–51.66] | 38.93 [35.58–42.91] |
| SQL sourceEncode | 0.33 [0.31–0.35] | 0.32 [0.30–0.35] |
| SQL sourceAppend | 793.34 [783.08–845.13] | 638.65 [559.27–846.37] |
| SQL sourceLoad | 1527.50 [1436.85–1627.81] | 1367.35 [1042.08–1566.91] |
| SQL seal | 65.73 [57.11–82.01] | 45.68 [43.34–83.16] |
| SQL query | 2881.10 [2714.30–2902.20] | 2444.30 [1985.90–3152.40] |
| SQL materialize | 7.00 [6.70–8.10] | 6.60 [5.30–8.10] |
| SQL resultTransfer | 17.73 [15.86–23.92] | 21.94 [17.10–27.94] |
| SQL waiting | 0.22 [0.20–0.30] | 0.18 [0.15–0.20] |
| SQL total | 36730.89 [35795.75–37704.86] | 29842.42 [24559.20–40747.80] |
| UI profiles | 82.00 [63.30–189.00] | 57.90 [45.80–156.50] |
| UI chartRows | 0.90 [0.80–1.10] | 1.10 [0.90–1.20] |
| UI chartOptions | 35.80 [33.60–48.90] | 30.50 [25.30–33.90] |
| UI chartSetOption | 141.80 [138.20–172.70] | 106.20 [98.40–148.00] |
| UI chartRendered | 190.50 [171.80–208.20] | 136.60 [123.80–182.00] |
| UI chartPainted | 366.60 [321.70–419.20] | 330.60 [318.10–359.00] |

| Perfiles | Antes | Después |
| --- | ---: | ---: |
| Llamadas por observación | [7, 7, 7] | [7, 7, 7] |
| profilesRoundtripMs | 79.70 [60.40–184.80] | 56.20 [43.20–154.00] |
| profilesMainHandlerMs | 34.01 [33.04–48.91] | 24.15 [23.06–47.01] |
| profilesOuterMs | 45.69 [27.36–135.89] | 33.14 [19.05–106.99] |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:plots.csv | 1164.86 [1036.07–1391.71] | 1256.44 [837.07–1538.09] |
| oracle:count | 2745.42 [2495.31–3204.96] | 2239.29 [1940.81–2925.43] |
| oracle:distinct | 2543.29 [2431.54–2956.15] | 2140.48 [2058.26–2565.96] |
| oracle:sum | 2638.08 [2566.69–2927.15] | 2265.56 [2045.81–2699.03] |
| oracle:average | 2638.42 [2478.23–3124.88] | 2240.98 [1952.58–2509.74] |
| oracle:min | 2937.99 [2309.37–3230.95] | 1928.07 [1784.41–3223.65] |
| oracle:max | 2825.83 [2462.24–2961.57] | 2656.53 [1928.46–3318.97] |
| oracle:median | 2864.10 [2529.21–2995.58] | 2259.08 [1925.00–2644.30] |
| open:ids.csv | 198.76 [136.81–240.58] | 177.47 [133.75–230.62] |
| ids:distinct | 2700.31 [2444.83–2732.72] | 1942.76 [1917.05–2598.29] |
| ids:chart | 12768.52 [12656.85–12806.97] | 9563.55 [9408.84–12747.95] |
| filtered-A:chart | 5509.36 [5451.49–7695.04] | 4350.50 [4282.93–6437.38] |
| filtered-B:chart | 5743.83 [5339.47–6300.98] | 5655.48 [3709.56–5678.19] |
| all:chart | 5796.41 [5784.23–6293.62] | 4640.70 [3718.47–7780.63] |
| number-again:chart | 5820.09 [5343.68–6280.91] | 5185.14 [3664.44–6275.57] |

## x64 · development · F2b: perfiles y dibujo con 200 campos

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "x64", "os": "24.6.0", "cpu": "Intel(R) Core(TM) i7-8700B CPU @ 3.20GHz", "logicalCpus": 4, "totalMemoryBytes": 15032385536, "node": "24.19.0", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [2, 2, 2] → [2, 2, 2]. SQL de warmup/oráculo separados: [2, 2, 2] → [2, 2, 2]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 4948.61 [4537.54–5660.83] | 5073.25 [4035.57–5756.10] |
| SQL window | 722.02 [706.47–813.99] | 752.96 [737.26–833.99] |
| SQL engine | 4226.59 [3831.07–4846.84] | 4336.00 [3201.57–5003.14] |
| SQL sourceStart | 1.48 [1.29–1.49] | 1.38 [1.22–1.75] |
| SQL sourceRead | 75.48 [61.05–76.24] | 44.03 [41.34–58.27] |
| SQL sourceEncode | 0.16 [0.11–0.17] | 0.12 [0.12–0.14] |
| SQL sourceAppend | 260.26 [223.61–346.07] | 218.22 [163.38–250.08] |
| SQL sourceLoad | 469.00 [421.38–548.73] | 394.83 [333.74–469.04] |
| SQL seal | 8.52 [6.37–61.81] | 7.05 [6.67–8.09] |
| SQL query | 572.80 [389.70–758.90] | 317.80 [309.90–591.50] |
| SQL materialize | 1.20 [1.10–1.50] | 0.70 [0.60–0.80] |
| SQL resultTransfer | 2.24 [1.98–2.48] | 2.13 [2.02–5.26] |
| SQL waiting | 0.10 [0.09–0.10] | 0.10 [0.07–0.12] |
| SQL total | 6281.15 [5370.84–6783.05] | 5807.01 [4704.19–6842.19] |
| UI profiles | 14120.10 [13003.30–14513.80] | 1357.10 [937.00–2166.60] |
| UI chartRows | 0.10 [0.00–0.30] | 0.10 [0.00–0.30] |
| UI chartOptions | 44.20 [42.00–45.10] | 37.10 [33.30–49.00] |
| UI chartSetOption | 11.00 [10.80–14.60] | 10.70 [8.00–11.20] |
| UI chartRendered | 55.20 [52.70–59.70] | 45.00 [43.90–60.30] |
| UI chartPainted | 70.60 [69.40–85.80] | 54.30 [53.60–75.10] |

| Perfiles | Antes | Después |
| --- | ---: | ---: |
| Llamadas por observación | [200, 200, 200] | [200, 200, 200] |
| profilesRoundtripMs | 14024.40 [12902.90–14414.40] | 1280.20 [888.90–2084.90] |
| profilesMainHandlerMs | 572.56 [561.85–588.69] | 597.72 [447.55–1032.80] |
| profilesOuterMs | 13435.71 [12341.05–13841.84] | 682.48 [441.35–1052.10] |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:ventas.csv | 1098.30 [1012.54–1817.78] | 1482.06 [653.02–1723.12] |
| warmup:chart | 7522.02 [7156.11–7610.39] | 7008.92 [6803.36–7341.03] |
| open:campos.csv | 218.82 [182.30–235.79] | 225.05 [195.24–283.87] |
| 200-fields:profiles-to-visible | 22538.15 [19966.92–23430.41] | 9617.98 [7468.01–9933.69] |

## x64 · development · SQL: carga y resultados con más de 50 MiB

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "x64", "os": "24.6.0", "cpu": "Intel(R) Core(TM) i7-8700B CPU @ 3.20GHz", "logicalCpus": 4, "totalMemoryBytes": 15032385536, "node": "24.19.0", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [1, 1, 1] → [1, 1, 1]. SQL de warmup/oráculo separados: [0, 0, 0] → [0, 0, 0]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 2442.35 [2336.56–2970.74] | 2336.46 [1465.65–2960.38] |
| SQL window | 370.19 [347.76–465.04] | 314.19 [214.24–360.87] |
| SQL engine | 2072.16 [1988.80–2505.70] | 1975.59 [1251.41–2646.19] |
| SQL sourceStart | 1.69 [1.59–1.84] | 1.71 [1.24–3.27] |
| SQL sourceRead | 4280.85 [4239.22–5092.49] | 3586.89 [3472.93–4705.60] |
| SQL sourceEncode | 118.40 [115.25–160.99] | 100.24 [87.63–110.45] |
| SQL sourceAppend | 11633.54 [11255.04–13155.11] | 1385.46 [1114.74–1566.42] |
| SQL sourceLoad | 16895.96 [15753.15–17555.42] | 5132.80 [4709.16–6432.30] |
| SQL seal | 3.70 [3.64–7.07] | 2.64 [2.54–3.55] |
| SQL query | 57.20 [55.90–83.20] | 38.30 [37.20–43.20] |
| SQL materialize | 0.70 [0.40–1.00] | 0.30 [0.30–0.40] |
| SQL resultTransfer | 1.46 [1.11–1.52] | 0.93 [0.82–1.78] |
| SQL waiting | 0.52 [0.41–0.90] | 0.51 [0.36–1.70] |
| SQL total | 19479.45 [18815.29–19986.74] | 8164.82 [6237.11–8837.17] |
| UI profiles | — | — |
| UI chartRows | — | — |
| UI chartOptions | — | — |
| UI chartSetOption | — | — |
| UI chartRendered | — | — |
| UI chartPainted | — | — |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:fuente-completa.csv | 2288.49 [2249.26–2538.23] | 2864.58 [1512.35–2887.11] |
| 50MiB:query-to-visible | 20692.17 [19965.25–21141.51] | 9352.63 [7000.60–9950.23] |

## x64 · development · TEN-1: consulta y dibujo con 300000 filas reales

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "x64", "os": "24.6.0", "cpu": "Intel(R) Core(TM) i7-8700B CPU @ 3.20GHz", "logicalCpus": 4, "totalMemoryBytes": 15032385536, "node": "24.19.0", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [2, 2, 2] → [1, 1, 1]. SQL de warmup/oráculo separados: [0, 0, 0] → [0, 0, 0]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 5401.25 [4291.26–6179.41] | 1759.55 [1610.74–2216.45] |
| SQL window | 726.66 [716.22–732.63] | 280.78 [226.33–333.84] |
| SQL engine | 4668.61 [3575.04–5452.75] | 1478.77 [1384.42–1882.61] |
| SQL sourceStart | 2.04 [1.95–16.49] | 1.11 [0.98–1.57] |
| SQL sourceRead | 12244.05 [12214.00–12510.30] | 5055.91 [4911.57–7081.95] |
| SQL sourceEncode | 49.31 [49.10–61.06] | 23.66 [23.52–26.78] |
| SQL sourceAppend | 9893.21 [9741.74–11257.14] | 2551.78 [2049.51–2711.09] |
| SQL sourceLoad | 22394.30 [22140.48–23998.26] | 7670.45 [7029.11–9887.35] |
| SQL seal | 20.91 [13.12–21.67] | 4.04 [3.71–94.02] |
| SQL query | 1325.50 [1274.10–2012.90] | 1196.30 [871.10–1346.30] |
| SQL materialize | 225.70 [204.20–331.40] | 148.30 [148.10–214.40] |
| SQL resultTransfer | 15.62 [14.09–25.19] | 12.09 [9.67–14.16] |
| SQL waiting | 0.37 [0.23–2.59] | 0.23 [0.23–0.35] |
| SQL total | 30223.30 [28006.33–31896.35] | 10829.32 [9718.58–13824.37] |
| UI profiles | — | — |
| UI chartRows | 59.70 [55.40–69.40] | 59.00 [47.70–79.60] |
| UI chartOptions | 157.00 [147.10–183.10] | 134.20 [91.70–160.30] |
| UI chartSetOption | 256.10 [245.60–344.40] | 278.60 [193.70–297.70] |
| UI chartRendered | 413.30 [392.70–527.60] | 412.90 [285.40–458.00] |
| UI chartPainted | 611.00 [526.70–646.10] | 514.30 [353.70–542.80] |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:many.csv | 3190.42 [3132.01–3709.68] | 3558.30 [2264.57–4095.52] |
| 300000:configure | 935.92 [863.22–945.28] | 801.49 [760.16–914.82] |
| 300000:query-to-visible | 31250.27 [28897.27–32990.17] | 11773.38 [10434.73–14862.57] |

## x64 · packaged · Constructor: operaciones y cambios de alcance completos

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "x64", "os": "24.6.0", "cpu": "Intel(R) Core(TM) i7-8700B CPU @ 3.20GHz", "logicalCpus": 4, "totalMemoryBytes": 15032385536, "node": "24.19.0", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [14, 14, 14] → [14, 14, 14]. SQL de warmup/oráculo separados: [8, 8, 8] → [8, 8, 8]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 31154.86 [25575.20–32741.91] | 21595.10 [21082.23–22594.59] |
| SQL window | 4958.14 [4016.84–5034.78] | 3368.71 [3218.55–3459.51] |
| SQL engine | 26120.08 [21558.35–27783.77] | 18376.55 [17622.72–19225.89] |
| SQL sourceStart | 14.49 [9.57–18.36] | 9.42 [8.16–10.87] |
| SQL sourceRead | 46.59 [43.44–47.06] | 34.04 [31.83–35.79] |
| SQL sourceEncode | 0.34 [0.33–0.35] | 0.30 [0.28–0.31] |
| SQL sourceAppend | 864.47 [722.04–867.40] | 550.09 [543.27–552.37] |
| SQL sourceLoad | 1598.51 [1369.65–1658.05] | 1083.88 [1020.78–1094.63] |
| SQL seal | 72.35 [55.87–79.98] | 45.89 [44.00–60.37] |
| SQL query | 2695.50 [2299.20–2980.60] | 1817.40 [1775.50–1961.30] |
| SQL materialize | 6.50 [6.20–7.20] | 5.30 [5.30–5.50] |
| SQL resultTransfer | 17.59 [16.94–21.24] | 19.99 [16.77–40.33] |
| SQL waiting | 0.23 [0.23–0.26] | 0.18 [0.14–0.20] |
| SQL total | 35638.70 [29444.03–37555.06] | 24640.40 [24071.54–25793.04] |
| UI profiles | 77.80 [57.30–91.70] | 67.40 [37.50–70.70] |
| UI chartRows | 0.90 [0.90–1.10] | 0.80 [0.60–1.10] |
| UI chartOptions | 34.10 [33.00–35.10] | 23.00 [22.70–27.60] |
| UI chartSetOption | 145.20 [102.60–156.60] | 91.20 [84.70–101.90] |
| UI chartRendered | 179.30 [135.80–191.60] | 118.80 [107.50–124.40] |
| UI chartPainted | 319.20 [263.00–354.20] | 313.40 [309.20–319.70] |

| Perfiles | Antes | Después |
| --- | ---: | ---: |
| Llamadas por observación | [7, 7, 7] | [7, 7, 7] |
| profilesRoundtripMs | 74.90 [54.30–88.80] | 64.50 [35.80–68.00] |
| profilesMainHandlerMs | 36.37 [32.66–36.45] | 24.40 [23.93–31.90] |
| profilesOuterMs | 38.45 [21.64–52.43] | 32.60 [11.40–44.07] |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:plots.csv | 1464.10 [743.78–1601.07] | 871.76 [793.71–891.65] |
| oracle:count | 2499.40 [2197.25–3015.04] | 1755.87 [1751.96–1791.25] |
| oracle:distinct | 2559.66 [1956.89–2693.51] | 1710.79 [1545.36–1746.50] |
| oracle:sum | 2602.34 [2201.81–3751.80] | 1638.56 [1589.04–1968.81] |
| oracle:average | 2404.39 [2027.19–3524.22] | 1844.62 [1668.07–2043.35] |
| oracle:min | 2993.99 [2068.96–3065.06] | 1696.73 [1676.65–1797.67] |
| oracle:max | 2581.47 [1959.49–2956.92] | 1944.06 [1797.05–2266.89] |
| oracle:median | 2460.69 [1966.03–3047.71] | 1731.68 [1633.05–1790.29] |
| open:ids.csv | 133.00 [115.86–190.61] | 100.19 [99.86–132.30] |
| ids:distinct | 2418.40 [2158.44–3141.67] | 1920.75 [1798.60–2066.96] |
| ids:chart | 12190.88 [10507.69–13953.98] | 9421.97 [8369.73–9603.39] |
| filtered-A:chart | 5435.74 [5417.60–6591.34] | 4345.76 [4319.95–4424.53] |
| filtered-B:chart | 5283.93 [4711.15–5841.10] | 4118.42 [3696.09–4148.28] |
| all:chart | 5689.98 [4698.23–6266.42] | 4238.73 [4141.09–4258.53] |
| number-again:chart | 5725.86 [4693.65–5785.65] | 4113.27 [3638.64–4165.13] |

## x64 · packaged · SQL: carga y resultados con más de 50 MiB

Máquina/Node/Electron idénticos en los metadatos: `{"platform": "darwin", "arch": "x64", "os": "24.6.0", "cpu": "Intel(R) Core(TM) i7-8700B CPU @ 3.20GHz", "logicalCpus": 4, "totalMemoryBytes": 15032385536, "node": "24.19.0", "electron": "44.9.2"}`.

SQL de la ruta medidos por observación: [1, 1, 1] → [1, 1, 1]. SQL de warmup/oráculo separados: [0, 0, 0] → [0, 0, 0]. Cero incompletos.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| window + engine (arranque de ventana y motor) | 2376.68 [1790.74–3925.17] | 1516.43 [1418.99–3334.12] |
| SQL window | 399.21 [319.17–452.09] | 249.27 [221.86–270.66] |
| SQL engine | 1924.58 [1471.56–3525.97] | 1245.77 [1197.13–3084.85] |
| SQL sourceStart | 1.47 [1.36–2.82] | 1.49 [1.16–1.63] |
| SQL sourceRead | 3434.93 [3243.60–5332.64] | 3393.51 [2648.19–3541.09] |
| SQL sourceEncode | 98.13 [95.28–139.15] | 118.05 [84.09–231.01] |
| SQL sourceAppend | 9154.56 [8456.07–15096.21] | 1343.38 [1102.85–2393.00] |
| SQL sourceLoad | 12742.59 [11831.80–20768.65] | 4888.05 [3875.76–6257.26] |
| SQL seal | 2.98 [2.75–6.28] | 2.33 [2.16–2.99] |
| SQL query | 42.50 [41.60–49.20] | 32.20 [29.70–34.20] |
| SQL materialize | 0.30 [0.20–0.30] | 0.30 [0.30–0.50] |
| SQL resultTransfer | 1.12 [1.11–1.22] | 0.88 [0.81–1.24] |
| SQL waiting | 0.43 [0.34–1.06] | 0.33 [0.27–0.42] |
| SQL total | 15185.75 [13689.00–24790.75] | 6459.22 [5350.32–9651.36] |
| UI profiles | — | — |
| UI chartRows | — | — |
| UI chartOptions | — | — |
| UI chartSetOption | — | — |
| UI chartRendered | — | — |
| UI chartPainted | — | — |

### Pasos completos de la sonda

| Paso | Antes, ms | Después, ms |
| --- | ---: | ---: |
| open:fuente-completa.csv | 2736.49 [1991.53–3412.00] | 2019.14 [1650.69–2314.83] |
| 50MiB:query-to-visible | 16089.91 [14844.44–25818.30] | 7514.65 [5984.30–10486.79] |

## Validez y límites

- Fixtures idénticos: seis nombres, bytes y SHA-256; todas las fuentes mantienen hash y mtime tras cada observación.
- Harness idéntico byte a byte en los tres archivos; los SHA-256 constan en harness-sha256.json.
- sourceLoad contiene start/read/encode/append y otras operaciones: no sumar con sus componentes.
- chartRendered abarca chartOptions y setOption; chartPainted añade presentación con dos requestAnimationFrame: son medidas superpuestas.
- resultTransfer es una aproximación de despacho y serialización: duración del viaje executeJavaScript menos query/materialize del motor. No es latencia exclusiva de transferencia ni resta relojes de procesos distintos.
- profilesOuterMs es roundtrip menos handler; aproxima despacho, serialización y trabajo de interfaz, no CPU exclusiva.
- Los ocho SQL iniciales de Constructor son oráculos directos de la sonda y se informan separados. En F2b se excluye la apertura/cálculo inicial de ventas de ocho filas.
- Que los metadatos de máquina coincidan no demuestra igual carga del anfitrión. Son tres observaciones por grupo; no equivalen a garantías universales de rendimiento.
- No se ejecutó aquí una CI Intel completa ni se actualizó la aplicación instalada.
