import { expect, test } from 'claude-code/testing'
import type { ElementQuery, FoundElement } from 'claude-code/testing'
import type { SessionMeasureInput, SessionUsage } from 'claude-code'

const BAND = {
  plugin: 'usage',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const USAGE = {
  rateLimits: [
    { kind: 'five_hour', percentUsed: 45, resetsAt: '2026-11-09T13:00:00Z' },
    { kind: 'seven_day', percentUsed: 3, resetsAt: '2026-11-12T23:00:00Z' },
  ],
} as unknown as SessionUsage

// A reading that moved: the mod asks the usage endpoint again on it, and the
// hook answers once that question has settled.
const MEASURE = {
  context: { window: 200000 },
  rateLimits: USAGE.rateLimits,
  changed: ['rateLimits'],
} as SessionMeasureInput

// The usage endpoint's rows as the server sends them.
const rows = (...scoped: object[]) => ({
  status: 200,
  ok: true,
  headers: {},
  text: JSON.stringify({
    limits: [
      { kind: 'session', group: 'session', percent: 45, resets_at: '2026-11-09T13:00:00+00:00', scope: null },
      { kind: 'weekly_all', group: 'weekly', percent: 3, resets_at: '2026-11-12T23:00:00+00:00', scope: null },
      ...scoped,
    ],
  }),
})

const FABLE = {
  kind: 'weekly_scoped',
  group: 'weekly',
  percent: 12,
  resets_at: '2026-11-11T18:00:00+00:00',
  scope: { model: { id: null, display_name: 'Fable' }, surface: null },
}

// The band as VS Code and the desktop have it: one SVG, its words in `alt`.
async function svgOf(ui: { find: (query: ElementQuery) => Promise<FoundElement | undefined> }) {
  const svg = await ui.find({ type: 'Svg' })

  return { alt: String(svg?.props.alt ?? ''), source: String(svg?.props.source ?? ''), height: svg?.props.height }
}

test('the band draws both windows on every surface', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: USAGE }))
  on('clock.now', () => ({ value: Date.parse('2026-11-09T12:00:00Z') }))
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await terminal.find({ type: 'Text', text: '45%' }))?.text).toBe('45%')
  expect((await terminal.find({ type: 'Text', text: '3%' }))?.text).toBe('3%')
  expect(await terminal.find({ type: 'Text', text: 'Fable' })).toBeUndefined()
  await terminal.unmount()

  for (const surface of ['vscode', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const { alt, source, height } = await svgOf(ui)
    expect(alt).toBe('5h 45% ↻ 1h 00m · 7d 3% ↻ 3d 11h')
    // Each bar fills its share of its 48% half.
    expect(source).toContain('width="21.6%"')
    expect(source).toContain('width="1.44%"')
    expect(source).toContain('font-size="11"')
    expect(height).toBe(20)
    await ui.unmount()
  }
})

test('the desktop SVG inks its figures by the colour scheme, VS Code by currentColor', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: USAGE }))
  on('clock.now', () => ({ value: Date.parse('2026-11-09T12:00:00Z') }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const ink = (await svgOf(desktop)).source
  expect(ink).toContain('prefers-color-scheme: dark')
  expect(ink).toContain('class="ink"')
  expect(ink).not.toContain('currentColor')
  await desktop.unmount()

  const vscode = await $.ui.mount({ ...BAND, surface: 'vscode' })
  const plain = (await svgOf(vscode)).source
  expect(plain).toContain('currentColor')
  expect(plain).not.toContain('<style>')
  await vscode.unmount()
})

test('the renew times are shown and move with each new reading', async ($, on) => {
  let now = Date.parse('2026-11-09T12:00:00Z')
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.usage', () => ({ value: USAGE }))
  on('clock.now', () => ({ value: now }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await terminal.find({ type: 'Text', text: /↻ 1h/ }))?.text).toBe('↻ 1h 00m')
  expect((await terminal.find({ type: 'Text', text: /↻ 3d/ }))?.text).toBe('↻ 3d 11h')
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await svgOf(desktop)).alt).toBe('5h 45% ↻ 1h 00m · 7d 3% ↻ 3d 11h')
  await desktop.unmount()

  now += 30 * 60_000
  await $.session.measure(MEASURE)
  const vscode = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect((await svgOf(vscode)).alt).toContain('↻ 0h 30m')
  await vscode.unmount()
})

test("Fable's weekly window has a bar of its own while the account has one", async ($, on) => {
  let now = Date.parse('2026-11-09T12:00:00Z')
  let answer = rows(FABLE)
  const asked: { url: string; auth?: string }[] = []
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.usage', () => ({ value: USAGE }))
  on('session.authorize', () => ({ value: { handle: 'held', kind: 'bearer' } }))
  on('http.fetch', (_, e) => {
    asked.push({ url: e.url, auth: e.init?.auth })

    return { value: answer }
  })
  on('clock.now', () => ({ value: now }))
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await $.session.measure(MEASURE)

  expect(asked).toEqual([{ url: 'https://api.anthropic.com/api/oauth/usage', auth: 'held' }])
  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await terminal.find({ type: 'Text', text: 'Fable' }))?.text).toBe('Fable')
  expect((await terminal.find({ type: 'Text', text: '12%' }))?.text).toBe('12%')
  expect((await terminal.find({ type: 'Text', text: /↻ 2d/ }))?.text).toBe('↻ 2d 06h')
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await svgOf(desktop)).alt).toContain('Fable 12% ↻ 2d 06h')
  await desktop.unmount()

  let ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  let svg = await svgOf(ui)
  expect(svg.alt).toBe('5h 45% ↻ 1h 00m · 7d 3% ↻ 3d 11h · Fable 12% ↻ 2d 06h')
  // The Fable bar runs the whole width: 12% of it.
  expect(svg.source).toContain('width="12%"')
  expect(svg.height).toBe(42)
  await ui.unmount()

  // Asked again within five minutes: the endpoint is left alone.
  now += 60_000
  await $.session.measure(MEASURE)
  expect(asked.length).toBe(1)

  // A failed answer keeps the last reading.
  now += 5 * 60_000
  answer = { status: 429, ok: false, headers: {}, text: '' }
  await $.session.measure(MEASURE)
  expect(asked.length).toBe(2)
  ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect((await svgOf(ui)).alt).toContain('Fable 12%')
  await ui.unmount()

  // The promotion over, the rows name no Fable window: its bar leaves.
  now += 5 * 60_000
  answer = rows()
  await $.session.measure(MEASURE)
  ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  svg = await svgOf(ui)
  expect(svg.alt).not.toContain('Fable')
  expect(svg.height).toBe(20)
  await ui.unmount()
})

test("another model's weekly window draws no bar", async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.usage', () => ({ value: USAGE }))
  on('session.authorize', () => ({ value: { handle: 'held', kind: 'bearer' } }))
  on('http.fetch', () => ({
    value: rows({ ...FABLE, scope: { model: { id: null, display_name: 'Sonnet' }, surface: null } }),
  }))
  on('clock.now', () => ({ value: Date.parse('2026-11-09T12:00:00Z') }))
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await $.session.measure(MEASURE)

  const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect((await svgOf(ui)).alt).not.toContain('Sonnet')
  await ui.unmount()
})
