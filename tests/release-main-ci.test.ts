import { describe, expect, it, vi } from 'vitest'
import { requireMainCI } from '../scripts/require-main-ci.mjs'

const sha = 'a'.repeat(40)
const environment = {
 REQUESTED_SHA: sha,
 CURRENT_MAIN_SHA: sha,
 GITHUB_REPOSITORY: 'ruzer/freyalab',
 GITHUB_API_URL: 'https://api.github.com',
 GH_TOKEN: 'test-token',
}
const green = { head_sha: sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', html_url: 'https://github.com/ruzer/freyalab/actions/runs/12' }
const response = (runs: unknown[]) => vi.fn(async (_url: URL, _options: { headers: Record<string, string> }) => Response.json({ workflow_runs: runs }))

describe('gate de Release candidate', () => {
 it('consulta CI por SHA exacto, push y main', async () => {
  const request = response([green])
  await expect(requireMainCI(environment, request)).resolves.toBe(green.html_url)
  const [url, options] = request.mock.calls[0]
  expect(url.pathname).toBe('/repos/ruzer/freyalab/actions/workflows/ci.yml/runs')
  expect(Object.fromEntries(url.searchParams)).toEqual({ head_sha: sha, branch: 'main', event: 'push', per_page: '1' })
  expect(options.headers.Authorization).toBe('Bearer test-token')
 })
 it('rechaza un SHA que ya no es main antes de llamar a GitHub', async () => {
  const request = response([green])
  await expect(requireMainCI({ ...environment, CURRENT_MAIN_SHA: 'b'.repeat(40) }, request)).rejects.toThrow('SHA actual de main')
  expect(request).not.toHaveBeenCalled()
 })
 it.each([
  ['falta la CI', []],
  ['está en curso', [{ ...green, status: 'in_progress', conclusion: null }]],
  ['la última falló aunque haya una anterior verde', [{ ...green, conclusion: 'failure' }, green]],
  ['es de otro SHA', [{ ...green, head_sha: 'b'.repeat(40) }]],
  ['es de un PR', [{ ...green, event: 'pull_request' }]],
  ['es de otra rama', [{ ...green, head_branch: 'feature' }]],
 ])('rechaza cuando %s', async (_label, runs) => {
  await expect(requireMainCI(environment, response(runs))).rejects.toThrow('CI de main')
 })
 it('falla de forma explícita si la consulta no está autorizada', async () => {
  const request = vi.fn(async () => new Response(null, { status: 403 }))
  await expect(requireMainCI(environment, request)).rejects.toThrow('HTTP 403')
 })
})
