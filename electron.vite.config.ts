import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import {execFileSync} from 'node:child_process'
let buildCommit=''
try{buildCommit=execFileSync('git',['rev-parse','--short=7','HEAD'],{encoding:'utf8',timeout:2000,stdio:['ignore','pipe','ignore']}).trim()}catch{}
export default defineConfig({
 main:{define:{__FREYALAB_BUILD__:JSON.stringify(buildCommit)},plugins:[externalizeDepsPlugin()],build:{rollupOptions:{input:{index:resolve('src/main/index.ts'), 'table-worker':resolve('src/main/table-worker.ts'),'large-search-worker':resolve('src/main/large-search-worker.ts')}}}},
 preload:{plugins:[externalizeDepsPlugin()],build:{rollupOptions:{output:{format:'cjs',entryFileNames:'index.cjs'}}}},
 renderer:{plugins:[tailwindcss(),svelte()],build:{rollupOptions:{input:{index:resolve('src/renderer/index.html'),analytics:resolve('src/renderer/analytics.html')}}}}
})
