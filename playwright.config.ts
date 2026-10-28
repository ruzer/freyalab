import { defineConfig } from '@playwright/test'
import {shellFiles,mdFiles} from './tests/e2e/groups'
// El producto solo lee este valor cuando FREYALAB_TEST=1.
process.env.FREYALAB_LANG='es'
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {name:'shell',testMatch:shellFiles.map(file=>`**/${file}`)},
    {name:'md',testMatch:mdFiles.map(file=>`**/${file}`)},
    {name:'csv',testMatch:'**/*.spec.ts',testIgnore:[...shellFiles,...mdFiles].map(file=>`**/${file}`)},
  ]
})
