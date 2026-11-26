import { expect, mock, test } from 'claude-code/testing'
import type { ElementQuery, FoundElement } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { Progress } from '../types'

const BAND = {
  plugin: 'e2e-progress',
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

const START = Date.parse('2026-11-25T09:00:00Z')
const at = (ms: number) => new Date(START + ms).toISOString()
const FILE = /^\/data[\\/]progress-s1\.json$/

const RUN: Progress = {
  version: 1,
  status: 'running',
  result: null,
  total: 40,
  done: 10,
  passed: 8,
  failed: 1,
  flaky: 1,
  skipped: 0,
  current: 'files.spec.mjs › copies a file',
  startedAt: at(0),
  updatedAt: at(60_000),
}

// The world the plugin starts in: its data folder and session, the variables
// it sets, and the progress file, which the test writes by changing `file`.
function world(on: On, own: Record<string, string> = {}) {
  const world = { file: undefined as string | undefined, set: {} as Record<string, string | undefined>, read: [] as string[] }
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('process.hookEnv', () => ({ value: { CLAUDE_PLUGIN_DATA: '/data', CLAUDE_CODE_SESSION_ID: 's1' } }))
  mock.env(on, own)
  on('env.set', (_, e) => {
    world.set[e.name] = e.value

    return { value: {} }
  })
  on('fs.read', (_, e) => {
    world.read.push(e.path)

    return world.file === undefined ? { deny: 'ENOENT: no such file' } : { value: world.file }
  })

  return world
}

async function svgOf(ui: { find: (query: ElementQuery) => Promise<FoundElement | undefined> }) {
  const svg = await ui.find({ type: 'Svg' })

  return { alt: String(svg?.props.alt ?? ''), source: String(svg?.props.source ?? '') }
}

test('the session start sets the two variables, and reads nothing else of the run', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })

  expect(w.set.PW_TEST_REPORTER).toMatch(/hooks[\\/]progress-reporter\.mjs$/)
  expect(w.set.E2E_PROGRESS_FILE).toMatch(FILE)

  // No run yet: the file is looked for, and no band is drawn.
  await clock.advance(1000)
  expect(w.read.length).toBeGreaterThan(0)
  // The engine hands the hook the path made absolute: `c:\data\…` on Windows.
  expect(w.read.every(path => /[\\/]data[\\/]progress-s1\.json$/.test(path))).toBe(true)
  const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('a reporter the person set is left alone, and no run is followed', async ($, on) => {
  const clock = mock.clock(on, { now: START + 60_000 })
  const w = world(on, { PW_TEST_REPORTER: 'list' })
  w.file = JSON.stringify(RUN)
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await clock.advance(1000)

  expect(w.set).toEqual({})
  expect(w.read).toEqual([])
  const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('a run in progress draws its count, failures, flaky tests, time and the test running', async ($, on) => {
  const clock = mock.clock(on, { now: START + 60_000 })
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  w.file = JSON.stringify(RUN)
  await clock.advance(1000)

  for (const surface of ['vscode', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const { alt, source } = await svgOf(ui)
    expect(alt).toBe('E2E · 10/40 · ✘ 1 · 1 flaky · 25% · 1m 01s')
    expect(source).toContain('width="25%"')
    expect(source).toContain('#F2C230')
    expect(source).toContain('#E5484D')
    // The test running is not in the SVG, which cannot measure it, but a Text
    // of its own under it, wrapped rather than cut at the band's edge.
    expect(source).not.toContain('copies a file')
    const current = await ui.find({ type: 'Text', text: /copies a file/ })
    expect(current?.text).toBe('files.spec.mjs › copies a file')
    expect(current?.props.wrap).toBe('wrap')
    await ui.unmount()
  }

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await terminal.find({ type: 'Text', text: '10/40' }))?.text).toBe('10/40')
  expect((await terminal.find({ type: 'Text', text: '✘ 1' }))?.props.color).toBe('#E5484D')
  const percent = await terminal.find({ type: 'Text', text: '25%' })
  expect(percent?.text).toBe('25%')
  expect(percent?.props.dimColor).toBe(false)
  const running = await terminal.find({ type: 'Text', text: /copies a file/ })
  expect(running?.text).toBe('files.spec.mjs › copies a file')
  expect(running?.props.wrap).toBe('wrap')
  await terminal.unmount()

  // The next write moves the band on.
  w.file = JSON.stringify({ ...RUN, done: 30, passed: 28, updatedAt: at(90_000), current: 'find.spec.mjs › finds' })
  await clock.advance(30_000)
  const later = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect((await svgOf(later)).alt).toBe('E2E · 30/40 · ✘ 1 · 1 flaky · 75% · 1m 31s')
  expect((await svgOf(later)).source).toContain('width="75%"')
  expect((await later.find({ type: 'Text', text: /finds/ }))?.text).toBe('find.spec.mjs › finds')
  await later.unmount()
})

test('the share done is rounded down: 100% only once every test is done', async ($, on) => {
  const clock = mock.clock(on, { now: START + 60_000 })
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })

  // Each write a second after the one before, as the reporter's are: the band
  // moves on when `updatedAt` does.
  for (const [i, [done, total, shown]] of ([
    [199, 200, '99%'],
    [1, 3, '33%'],
    [0, 0, '0%'],
  ] as const).entries()) {
    w.file = JSON.stringify({ ...RUN, done, total, failed: 0, flaky: 0, updatedAt: at(61_000 + 1000 * i) })
    await clock.advance(1000)
    const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
    expect((await svgOf(ui)).alt).toContain(` · ${shown} · `)
    await ui.unmount()
  }
})

test('a long test name is drawn whole, however wide the band', async ($, on) => {
  const clock = mock.clock(on, { now: START + 60_000 })
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  const long =
    "archive-content.spec.mjs › una bomba zip › extreure-la no atura l'app, i cancel·lar-la a mitja entrada no deixa res, ni cap fitxer a mitges a la carpeta de destí"
  w.file = JSON.stringify({ ...RUN, current: long })
  await clock.advance(1000)

  for (const surface of ['vscode', 'desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /bomba zip/ }))?.text).toBe(long)
    await ui.unmount()
  }
})

test('the desktop SVG inks its words by the colour scheme, VS Code by currentColor', async ($, on) => {
  const clock = mock.clock(on, { now: START + 60_000 })
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  w.file = JSON.stringify(RUN)
  await clock.advance(1000)

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const ink = (await svgOf(desktop)).source
  expect(ink).toContain('prefers-color-scheme: dark')
  expect(ink).not.toContain('currentColor')
  await desktop.unmount()

  const vscode = await $.ui.mount({ ...BAND, surface: 'vscode' })
  const plain = (await svgOf(vscode)).source
  expect(plain).toContain('currentColor')
  expect(plain).not.toContain('<style>')
  await vscode.unmount()
})

test('a finished run stays a minute with its result, then the band leaves', async ($, on) => {
  const clock = mock.clock(on, { now: START + 120_000 })
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  w.file = JSON.stringify({
    ...RUN,
    status: 'done',
    result: 'passed',
    done: 40,
    passed: 36,
    failed: 0,
    flaky: 0,
    skipped: 4,
    current: null,
    updatedAt: at(120_000),
  })
  await clock.advance(1000)

  const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  const { alt, source } = await svgOf(ui)
  // The time is the run's own, not the clock's since.
  expect(alt).toBe('E2E · ✔ passed · 40/40 · 4 skipped · 100% · 2m 00s')
  expect(source).toContain('width="100%" height="4" rx="2" fill="#F2C230"')
  await ui.unmount()

  await clock.advance(60_000)
  const after = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect(await after.find({ type: 'Svg' })).toBeUndefined()
  await after.unmount()
})

test('a failed run says how it ended, in red', async ($, on) => {
  const clock = mock.clock(on, { now: START + 120_000 })
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  w.file = JSON.stringify({ ...RUN, status: 'done', result: 'failed', done: 40, current: null, updatedAt: at(120_000) })
  await clock.advance(1000)

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await terminal.find({ type: 'Text', text: '✘ failed' }))?.props.color).toBe('#E5484D')
  expect(await terminal.find({ type: 'Text', text: /copies a file/ })).toBeUndefined()
  await terminal.unmount()
})

test('a silent reporter is drawn as stalled, in grey, and let go after 15 minutes', async ($, on) => {
  const clock = mock.clock(on, { now: START + 60_000 })
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  w.file = JSON.stringify(RUN)
  await clock.advance(1000)
  await clock.advance(2 * 60_000)

  const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  const { alt, source } = await svgOf(ui)
  expect(alt).toBe('E2E · 10/40 · ✘ 1 · 1 flaky · 25% · 3m 01s · stalled?')
  expect(source).toContain('#8A8A8A')
  expect(source).not.toContain('#F2C230')
  await ui.unmount()

  await clock.advance(13 * 60_000)
  const gone = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect(await gone.find({ type: 'Svg' })).toBeUndefined()
  await gone.unmount()
})

test('a file that is not the reporter\'s draws nothing', async ($, on) => {
  const clock = mock.clock(on, { now: START + 60_000 })
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })

  for (const text of ['{"version":', JSON.stringify({ ...RUN, version: 2 })]) {
    w.file = text
    await clock.advance(1000)
    const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
    expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    await ui.unmount()
  }
})
