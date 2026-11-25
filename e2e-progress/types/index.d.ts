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

// The run the band follows: the file its reporter writes, and when the command
// that starts it was handed on. A file older than that is an earlier run's.
export type Watch = { file: string; armedAt: number }

declare module 'claude-code' {
  interface PluginState {
    'e2e-progress': { progress: Progress | null; now: number; watch: Watch | null }
  }
}
