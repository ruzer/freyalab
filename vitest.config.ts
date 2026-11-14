import { defineConfig } from 'vitest/config'
import {blockingTimeout} from './tests/helpers/blocking-timeout'
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], exclude: ['tests/e2e/**'], environment: 'node', testTimeout:blockingTimeout, hookTimeout:blockingTimeout } })
