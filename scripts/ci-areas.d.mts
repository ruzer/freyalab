export function classifyPaths(paths: readonly string[]): {
  checks: true
  unit: true
  e2e: ('shell' | 'md' | 'csv')[]
  full: boolean
  package: boolean
  specs: string[]
}
