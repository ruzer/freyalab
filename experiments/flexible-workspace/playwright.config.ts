import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'.',testMatch:'*.spec.ts',timeout:240_000,workers:1,fullyParallel:false,retries:0,reporter:'list',outputDir:'../../test-results/flexible-workspace'})
