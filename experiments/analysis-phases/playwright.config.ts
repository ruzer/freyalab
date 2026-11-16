import {defineConfig} from '@playwright/test'

export default defineConfig({
 testDir:'.',testMatch:'analysis-phases.spec.ts',workers:1,fullyParallel:false,repeatEach:3,retries:0,
 // Observación diagnóstica: hasta 22 operaciones con el límite real de 120 s, más arranque/E/S.
 timeout:24*120_000,expect:{timeout:120_000},reporter:'list',
 outputDir:'../../test-results/analysis-phases',use:{trace:'retain-on-failure',screenshot:'only-on-failure'}
})
