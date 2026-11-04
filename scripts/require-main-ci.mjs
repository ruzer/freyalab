export async function requireMainCI(env, request = fetch) {
  const { REQUESTED_SHA: sha, CURRENT_MAIN_SHA: current, GITHUB_REPOSITORY: repository, GITHUB_API_URL: api, GH_TOKEN: token } = env
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || sha !== current) {
    throw new Error(`Release candidate requiere el SHA actual de main (${current}).`)
  }
  if (!token) throw new Error('Falta el token de lectura de GitHub Actions para verificar la CI de main.')
  const url = new URL(`${api}/repos/${repository}/actions/workflows/ci.yml/runs`)
  url.search = new URLSearchParams({ head_sha: sha, branch: 'main', event: 'push', per_page: '1' })
  const result = await request(url, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!result.ok) throw new Error(`No se pudo verificar la CI de main para ${sha} (HTTP ${result.status}).`)
  const { workflow_runs: runs } = await result.json()
  const run = runs?.[0]
  if (run?.head_sha !== sha || run.head_branch !== 'main' || run.event !== 'push' ||
      run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error(`La CI de main de ${sha} debe aprobar antes de construir el candidato. Estado: ${run?.conclusion || run?.status || 'sin ejecución'}. ${run?.html_url || ''}`)
  }
  return run.html_url
}
