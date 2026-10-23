import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'.',testMatch:'probe.spec.ts',timeout:240_000,workers:1,fullyParallel:false,retries:0,reporter:'list',outputDir:'../../test-results/analysis-datasets'})
