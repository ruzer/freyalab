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
const green = { id: 12, head_sha: sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', html_url: 'https://github.com/ruzer/freyalab/actions/runs/12' }
const intel = { ...green, id: 13, event: 'schedule', html_url: 'https://github.com/ruzer/freyalab/actions/runs/13' }
const response = (runs: unknown[], events: Record<string, unknown[]> = {}) => vi.fn(async (url: URL, _options: { headers: Record<string, string> }) =>
 Response.json({ workflow_runs: url.searchParams.get('event') === 'push' ? runs : events[url.searchParams.get('event')!] ?? [] }))

describe('gate de Release candidate', () => {
 it('consulta push e Intel por SHA exacto y main, conservando la URL del push', async () => {
  const request = response([green], { schedule: [intel] })
  await expect(requireMainCI(environment, request)).resolves.toBe(green.html_url)
  expect(request).toHaveBeenCalledTimes(3)
  expect(request.mock.calls.map(([url]) => url.searchParams.get('event')).sort()).toEqual(['push', 'schedule', 'workflow_dispatch'])
  for (const [url, options] of request.mock.calls) {
   expect(url.pathname).toBe('/repos/ruzer/freyalab/actions/workflows/ci.yml/runs')
   expect(Object.fromEntries(url.searchParams)).toEqual({ head_sha: sha, branch: 'main', event: url.searchParams.get('event'), per_page: '1' })
   expect(options.headers.Authorization).toBe('Bearer test-token')
  }
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
 it.each(['schedule', 'workflow_dispatch'])('acepta Intel verde mediante %s', async event => {
  await expect(requireMainCI(environment, response([green], { [event]: [{ ...intel, event }] }))).resolves.toBe(green.html_url)
 })
 it.each([
  ['no hay corrida Intel', []],
  ['sigue en curso', [{ ...intel, status: 'in_progress', conclusion: null }]],
  ['falló', [{ ...intel, conclusion: 'failure' }]],
  ['fue cancelada', [{ ...intel, conclusion: 'cancelled' }]],
  ['fue omitida', [{ ...intel, conclusion: 'skipped' }]],
  ['es de otro SHA', [{ ...intel, head_sha: 'b'.repeat(40) }]],
  ['es de otra rama', [{ ...intel, head_branch: 'feature' }]],
  ['es de otro evento', [{ ...intel, event: 'pull_request' }]],
 ])('rechaza Intel cuando %s y explica cómo lanzarla', async (_label, runs) => {
  await expect(requireMainCI(environment, response([green], { schedule: runs }))).rejects.toThrow(/Intel.*CI.*manual.*main/)
 })
 it.each(['schedule', 'workflow_dispatch'])('otro SHA Intel no cuenta mediante %s', async event => {
  await expect(requireMainCI(environment, response([green], { [event]: [{ ...intel, event, head_sha: 'b'.repeat(40) }] })))
   .rejects.toThrow(/Intel.*manual.*main/)
 })
 it('una corrida Intel más reciente fallida no queda tapada por una verde del otro evento', async () => {
  await expect(requireMainCI(environment, response([green], { schedule: [intel], workflow_dispatch: [{ ...intel, id: 14, event: 'workflow_dispatch', conclusion: 'failure' }] })))
   .rejects.toThrow('Intel')
  await expect(requireMainCI(environment, response([green], { schedule: [{ ...intel, id: 15, conclusion: 'failure' }], workflow_dispatch: [{ ...intel, id: 14, event: 'workflow_dispatch' }] })))
   .rejects.toThrow('Intel')
 })
 it('una corrida manual posterior aprobada acredita Intel tras una nocturna fallida', async () => {
  await expect(requireMainCI(environment, response([green], { schedule: [{ ...intel, conclusion: 'failure' }], workflow_dispatch: [{ ...intel, id: 14, event: 'workflow_dispatch' }] })))
   .resolves.toBe(green.html_url)
 })
 it('un error al consultar Intel no acredita el candidato ni expone el token', async () => {
  const request = vi.fn(async (url: URL) => url.searchParams.get('event') === 'push' ? Response.json({ workflow_runs: [green] }) : new Response(null, { status: 403 }))
  await expect(requireMainCI(environment, request)).rejects.toThrow(/Intel.*HTTP 403/)
  await expect(requireMainCI(environment, request)).rejects.not.toThrow('test-token')
 })
})
