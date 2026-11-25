// A run's progress as hooks/progress-reporter.mjs writes it (version 1).
export type Progress = {
  version: 1
  status: 'running' | 'done'
  result: string | null
  total: number
  done: number
  passed: number
  failed: number
  flaky: number
  skipped: number
  current: string | null
  startedAt: string
  updatedAt: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'e2e-progress': { progress: Progress | null; now: number }
  }
}
