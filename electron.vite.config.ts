import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
export default defineConfig({
 main:{plugins:[externalizeDepsPlugin()],build:{rollupOptions:{input:{index:resolve('src/main/index.ts'), 'table-worker':resolve('src/main/table-worker.ts'),'large-search-worker':resolve('src/main/large-search-worker.ts')}}}},
 preload:{plugins:[externalizeDepsPlugin()],build:{rollupOptions:{output:{format:'cjs',entryFileNames:'index.cjs'}}}},
 renderer:{plugins:[tailwindcss(),svelte()],build:{rollupOptions:{input:{index:resolve('src/renderer/index.html'),analytics:resolve('src/renderer/analytics.html')}}}}
})
