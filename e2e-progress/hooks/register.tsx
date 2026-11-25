import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Progress, Watch } from '../types'

// The run as its reporter last wrote it, the clock its times are drawn from,
// and the run being followed. In $.state, so a reload keeps following it.
const progressAtom = atom({ plugin: 'e2e-progress', key: 'progress' } as const, null)
const nowAtom = atom({ plugin: 'e2e-progress', key: 'now' } as const, 0)
const watchAtom = atom({ plugin: 'e2e-progress', key: 'watch' } as const, null)

// A command that runs tests. `playwright install` and the like start no run.
const TESTS = /\bplaywright\b|\be2e\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b/i
const NOT_A_RUN = /\bplaywright\s+(install|install-deps|codegen|show-report|show-trace|merge-reports|--version|-V)\b/i

// The band stays this long after a run ends, then leaves.
const SHOW_DONE_MS = 60_000
// A run whose reporter has written nothing for this long is drawn as stalled,
// and past the second figure it is no longer followed.
const STALLED_MS = 2 * 60_000
const ABANDON_MS = 15 * 60_000
// A command that has started no run by then (it ran other tests, or none) is
// no longer followed.
const NO_RUN_MS = 10 * 60_000

const YELLOW = '#F2C230'
const RED = '#E5484D'
const GREY = '#8A8A8A'
const TRACK = 'inactive'
// The terminal's bar: a half block, more of it than any row is wide.
const LINE = '▄'.repeat(400)

// VS Code draws a mod's Text at the panel's own size whatever `size` asks, so
// there the band is one SVG, as in `usage`: its figures over a bar 4px thick.
const SVG_FONT = 11
const SVG_BAR = 4
const SVG_HEIGHT = 20
const INK_LIGHT = '#1F1F1E'
const INK_DARK = '#E8E6E1'
const INK_STYLE =
  `<style>.ink{fill:${INK_LIGHT}}` +
  `@media (prefers-color-scheme: dark){.ink{fill:${INK_DARK}}}</style>`
const DESKTOP_FONT = `system-ui, -apple-system, &#39;Segoe UI&#39;, sans-serif`
const CURRENT_MAX = 120

type Phase = 'running' | 'stalled' | 'done'

const phaseOf = (progress: Progress, now: number): Phase => {
  if (progress.status === 'done') return 'done'
  const updated = Date.parse(progress.updatedAt ?? progress.startedAt)

  return now - updated > STALLED_MS ? 'stalled' : 'running'
}

const two = (n: number) => String(n).padStart(2, '0')

// "45s", "3m 05s", "1h 02m".
const duration = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${two(seconds % 60)}s`

  return `${Math.floor(minutes / 60)}h ${two(minutes % 60)}m`
}

const elapsed = (progress: Progress, now: number) => {
  const end = progress.status === 'done' ? Date.parse(progress.updatedAt ?? '') : now

  return duration((Number.isFinite(end) ? end : now) - Date.parse(progress.startedAt))
}

const share = (progress: Progress) =>
  progress.total > 0 ? Math.round((10000 * Math.min(progress.done, progress.total)) / progress.total) / 100 : 0

// Playwright's own words for how a run ended.
const RESULT: Record<string, string> = {
  passed: '✔ passed',
  failed: '✘ failed',
  timedout: '✘ timed out',
  interrupted: '✘ interrupted',
}

type Part = { text: string; tone?: 'strong' | 'dim' | 'red' }

// The band's words, in the order drawn: the same on every surface.
function partsOf(progress: Progress, now: number): Part[] {
  const phase = phaseOf(progress, now)
  const parts: Part[] = [{ text: 'E2E', tone: 'strong' }]
  if (phase === 'done') {
    const result = progress.result ?? 'passed'
    parts.push({ text: RESULT[result] ?? `✘ ${result}`, tone: result === 'passed' ? undefined : 'red' })
  }
  parts.push({ text: `${progress.done}/${progress.total}` })
  if (progress.failed > 0) parts.push({ text: `✘ ${progress.failed}`, tone: 'red' })
  if (progress.flaky > 0) parts.push({ text: `${progress.flaky} flaky` })
  if (progress.skipped > 0) parts.push({ text: `${progress.skipped} skipped`, tone: 'dim' })
  parts.push({ text: elapsed(progress, now), tone: 'dim' })
  if (phase === 'stalled') parts.push({ text: 'stalled?', tone: 'dim' })
  if (phase === 'running' && progress.current) {
    const current = progress.current.length > CURRENT_MAX ? `${progress.current.slice(0, CURRENT_MAX - 1)}…` : progress.current
    parts.push({ text: current, tone: 'dim' })
  }

  return parts
}

const xml = (text: string) => text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

function bandSvg(progress: Progress, now: number, isDesktop: boolean) {
  const ink = isDesktop ? 'class="ink"' : 'fill="currentColor"'
  const color = phaseOf(progress, now) === 'stalled' ? GREY : YELLOW
  const spans = partsOf(progress, now).map(({ text, tone }, i) => {
    const dx = i === 0 ? '' : ' dx="6"'
    const look =
      tone === 'strong' ? ' font-weight="600"' : tone === 'dim' ? ' fill-opacity="0.65"' : tone === 'red' ? ` fill="${RED}"` : ''

    return `<tspan${dx}${look}>${xml(text)}</tspan>`
  })
  const group = isDesktop
    ? `<g fill="${INK_LIGHT}" font-family="${DESKTOP_FONT}" font-size="${SVG_FONT}">`
    : `<g fill="currentColor" font-size="${SVG_FONT}">`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${SVG_HEIGHT}">` +
    (isDesktop ? INK_STYLE : '') +
    group +
    (isDesktop ? `<text ${ink} x="0" y="${SVG_FONT}">` : `<text x="0" y="${SVG_FONT}">`) +
    spans.join('') +
    '</text>' +
    `<rect x="0" y="15" width="100%" height="${SVG_BAR}" rx="2" ${ink} fill-opacity="0.2"/>` +
    `<rect x="0" y="15" width="${share(progress)}%" height="${SVG_BAR}" rx="2" fill="${color}"/>` +
    '</g></svg>'
  )
}

const bandAlt = (progress: Progress, now: number) =>
  partsOf(progress, now)
    .map(part => part.text)
    .join(' · ')

// The two variables in front of the command, in the shell's own words: the
// run inherits them, Playwright adds the reporter to its config's.
const quoteBash = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
const quotePowerShell = (s: string) => `'${s.replace(/'/g, "''")}'`

function withVariables(tool: 'Bash' | 'PowerShell', command: string, reporter: string, file: string) {
  if (tool === 'PowerShell') {
    return `$env:PW_TEST_REPORTER=${quotePowerShell(reporter)}; $env:E2E_PROGRESS_FILE=${quotePowerShell(file)}; ${command}`
  }

  return `export PW_TEST_REPORTER=${quoteBash(reporter)} E2E_PROGRESS_FILE=${quoteBash(file)}; ${command}`
}

const isTestCommand = (command: string) =>
  TESTS.test(command) && !NOT_A_RUN.test(command) && !command.includes('PW_TEST_REPORTER')

async function arm($: EngineInterface): Promise<{ reporter: string; file: string }> {
  const env = await $.process.hookEnv()
  const root = $.plugin.root
  const sep = root.includes('\\') ? '\\' : '/'
  const data = env.CLAUDE_PLUGIN_DATA
  const session = env.CLAUDE_CODE_SESSION_ID || 'session'
  const file = `${data}${sep}progress-${session}.json`
  const armedAt = await $.clock.now()

  await update($, watchAtom, () => ({ file, armedAt }))
  await update($, progressAtom, () => null)
  await update($, nowAtom, () => armedAt)

  return { reporter: `${root}${sep}hooks${sep}progress-reporter.mjs`, file }
}

async function stop($: EngineInterface) {
  await update($, watchAtom, () => null)
  await update($, progressAtom, () => null)
}

// The file as the reporter last wrote it for this run: undefined while there
// is none, or only an earlier run's.
async function readRun($: EngineInterface, watch: Watch): Promise<Progress | undefined> {
  const text = await $.fs.read(watch.file).catch(() => undefined)
  if (text === undefined) return undefined
  try {
    const progress = JSON.parse(text) as Progress
    if (progress?.version !== 1) return undefined
    // The reporter starts after the command is handed on; a second's grace for
    // clocks read a moment apart.
    if (Date.parse(progress.startedAt) < watch.armedAt - 1000) return undefined

    return progress
  } catch {
    // Half a file cannot be read (a rename is atomic), but a hand-made one can.
    return undefined
  }
}

// One look at the followed run: the band's values moved on, or the run let go.
async function poll($: EngineInterface) {
  const watch = await read($, watchAtom)
  if (watch === null) return
  const now = await $.clock.now()
  const progress = await readRun($, watch)

  if (progress === undefined) {
    if (now - watch.armedAt > NO_RUN_MS) await stop($)

    return
  }
  const updated = Date.parse(progress.updatedAt ?? progress.startedAt)
  const isOver =
    (progress.status === 'done' && now - updated > SHOW_DONE_MS) ||
    (progress.status === 'running' && now - updated > ABANDON_MS)
  if (isOver) {
    await stop($)

    return
  }

  const last = await read($, progressAtom)
  if (last?.updatedAt !== progress.updatedAt || last?.status !== progress.status) {
    await update($, progressAtom, () => progress)
  }
  await update($, nowAtom, () => now)
}

// After the command: refused, or over in the foreground without a run of its
// own, there is nothing to follow; otherwise one look now, not a second later.
async function settle($: EngineInterface, isDenied: boolean, isInBackground: boolean) {
  if (isDenied) return stop($)
  if (isInBackground) return
  const watch = await read($, watchAtom)
  if (watch !== null && (await readRun($, watch)) === undefined) return stop($)
  await poll($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // Every second; a look costs one state read while no run is followed.
    $.clock.every(1000, () => {
      void poll($).catch(() => {})
    })

    return started
  })

  // A hook that fails leaves the command as it was: the tests still run, unfollowed.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!isTestCommand(e.command)) return next(e)

    const { reporter, file } = await arm($)
    const ran = await next({ ...e, command: withVariables('Bash', e.command, reporter, file) })
    await settle($, ran.deny !== undefined, e.run_in_background === true)

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'PowerShell' }, async ($, e, next) => {
    if (!isTestCommand(e.command)) return next(e)

    const { reporter, file } = await arm($)
    const ran = await next({ ...e, command: withVariables('PowerShell', e.command, reporter, file) })
    await settle($, ran.deny !== undefined, e.run_in_background === true)

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const progress = await read($, progressAtom)
    if (progress === null) return next(e)
    const now = await read($, nowAtom)

    if (e.surface === 'vscode' || e.surface === 'desktop') {
      const { Box, Svg } = $.ui.resolve(e)

      return (
        <Box flexDirection="column" width="100%">
          <Svg
            source={bandSvg(progress, now, e.surface === 'desktop')}
            alt={bandAlt(progress, now)}
            height={SVG_HEIGHT}
          />
        </Box>
      )
    }

    // The terminal (and the mobile apps): the words above a bar of glyphs, as
    // `usage` draws its meters.
    const { Box, Text } = $.ui.resolve(e)
    const done = Math.round(share(progress))
    const color = phaseOf(progress, now) === 'stalled' ? GREY : YELLOW

    return (
      <Box flexDirection="column" width="100%">
        <Box flexDirection="row" columnGap={1}>
          {partsOf(progress, now).map(({ text, tone }) => (
            <Text
              size="footnote"
              tabular
              weight={tone === 'strong' ? 'semibold' : undefined}
              dimColor={tone === 'dim'}
              color={tone === 'red' ? RED : undefined}
              wrap="truncate-end"
            >
              {text}
            </Text>
          ))}
        </Box>
        <Box flexDirection="row" width="100%" height={1} overflow="hidden">
          {done > 0 ? (
            <Box width={`${done}%`} height={1} overflow="hidden">
              <Text color={color}>{LINE}</Text>
            </Box>
          ) : null}
          <Box flexGrow={1} width={0} height={1} overflow="hidden">
            <Text color={TRACK}>{LINE}</Text>
          </Box>
        </Box>
      </Box>
    )
  })
}
