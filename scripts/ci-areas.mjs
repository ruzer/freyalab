import {readFileSync} from 'node:fs'
import {posix} from 'node:path'
import {mdFiles,shellFiles} from '../tests/e2e/groups.ts'

// Solo se reduce cobertura en rutas revisadas. Los archivos nuevos son transversales.
const areas = {
  md: [
    'src/renderer/components/AssetWarnings.svelte',
    'src/renderer/components/Diagram.svelte',
    'src/renderer/components/MarkdownToolbar.svelte',
    'src/renderer/components/Outline.svelte',
    'src/renderer/components/PandocDialog.svelte',
    'src/renderer/components/TextStats.svelte',
    'src/renderer/lib/asset-changes.ts',
    'src/renderer/lib/citation-completion.ts',
    'src/renderer/lib/diagram-diagnostics.ts',
    'src/renderer/lib/diagram-errors.ts',
    'src/renderer/lib/diagram-marks.ts',
    'src/renderer/lib/markdown-commands.ts',
    'src/renderer/lib/markdown-editing.ts',
    'src/renderer/lib/markdown-paste.ts',
    'src/renderer/lib/markdown-tasks.ts',
    'src/renderer/lib/outline.ts',
    'src/renderer/lib/text-stats.ts',
    'src/renderer/lib/text-stats.worker.ts',
  ],
  csv: [
    'src/main/analysis-source.ts',
    'src/main/chart-presets.ts',
    'src/main/chart-result-export.ts',
    'src/main/chart-result.ts',
    'src/main/csv-open-error.ts',
    'src/main/csv-text-codec.ts',
    'src/main/csv-view-store.ts',
    'src/main/extract.ts',
    'src/main/job-queue.ts',
    'src/main/large-matches.ts',
    'src/main/large-search-pool.ts',
    'src/main/large-search-scan.ts',
    'src/main/large-search-worker.ts',
    'src/main/large-table.ts',
    'src/main/large-view-schema.ts',
    'src/main/large-view.ts',
    'src/main/operation-schema.ts',
    'src/main/operations.ts',
    'src/main/query-schema.ts',
    'src/main/sql-service.ts',
    'src/main/table-analysis.ts',
    'src/main/table-client.ts',
    'src/main/table-engine.ts',
    'src/main/table-query.ts',
    'src/main/table-worker.ts',
    'src/renderer/analytics.html',
    'src/renderer/analytics.ts',
    'src/renderer/components/AnalysisDock.svelte',
    'src/renderer/components/ChartFields.svelte',
    'src/renderer/components/ChartPresets.svelte',
    'src/renderer/components/CsvCharts.svelte',
    'src/renderer/components/CsvColumnAnalysis.svelte',
    'src/renderer/components/CsvColumnsOverview.svelte',
    'src/renderer/components/CsvCommands.svelte',
    'src/renderer/components/CsvExtract.svelte',
    'src/renderer/components/CsvFileMenu.svelte',
    'src/renderer/components/CsvOpenError.svelte',
    'src/renderer/components/CsvQueryTools.svelte',
    'src/renderer/components/CsvRangePreview.svelte',
    'src/renderer/components/CsvSql.svelte',
    'src/renderer/components/CsvStatistics.svelte',
    'src/renderer/components/CsvTable.svelte',
    'src/renderer/components/CsvTransform.svelte',
    'src/renderer/components/CsvViewDialog.svelte',
    'src/renderer/lib/csv-text-model.ts',
    'src/renderer/lib/sql-report.ts',
    'src/renderer/lib/statistics-report.ts',
    'src/renderer/lib/virtual-scroll.ts',
  ],
}
const projects=['shell','md','csv']
const byPath=new Map(Object.entries(areas).flatMap(([area,paths])=>paths.map(path=>[path,area])))
const documentation=/^(?:[^/]+\.md|docs\/[^/]+\.md|docs\/(?:audit|evidence|stories)\/.+\.md|docs\/design\/[^/]+\.(?:html|md))$/
const packagePath=/^(?:package(?:-lock)?\.json$|electron\.vite\.config\.ts$|electron-builder\.[^/]+$|(?:build|src\/(?:main|preload))\/)/
const specPath=/^tests\/e2e\/.+\.spec\.ts$/

export function classifyPaths(paths) {
  const selected=new Set(),specs=new Set()
  let full=paths.length===0,pack=false
  for(const path of paths){
    if(typeof path!=='string'||/[\\\x00-\x1f]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..')){
      full=true
      continue
    }
    if(packagePath.test(path))pack=true
    if(documentation.test(path))continue
    if(specPath.test(path)){
      const file=posix.basename(path)
      specs.add(path)
      selected.add('shell')
      selected.add(shellFiles.includes(file)?'shell':mdFiles.includes(file)?'md':'csv')
      continue
    }
    const area=byPath.get(path)
    if(area){
      selected.add('shell')
      selected.add(area)
    }else full=true
  }
  return {checks:true,unit:true,e2e:projects.filter(project=>full||selected.has(project)),full,package:pack,specs:[...specs].sort()}
}

if(import.meta.main){
  const args=process.argv.slice(2)
  const input=args.length===1&&args[0]==='--stdin'?readFileSync(0,'utf8'):null
  const paths=input===null?args:input.endsWith('\0')?input.slice(0,-1).split('\0'):[]
  process.stdout.write(JSON.stringify(classifyPaths(paths))+'\n')
}
