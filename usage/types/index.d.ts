export type UsageWindow = { kind: string; percentUsed: number; resetsAt: string | null }

// One model's own weekly window, under the name the account's usage rows give it.
export type ModelWindow = { name: string; percentUsed: number; resetsAt: string | null }

declare module 'claude-code' {
  interface PluginState {
    'usage': { limits: Shaped<UsageWindow[]>; model: ModelWindow | null; now: number }
  }
}
