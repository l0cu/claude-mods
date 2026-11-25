import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Progress } from '../types'

// The run as its reporter last wrote it, and the clock its times are drawn from.
const progressAtom = atom({ plugin: 'e2e-progress', key: 'progress' } as const, null)
const nowAtom = atom({ plugin: 'e2e-progress', key: 'now' } as const, 0)

// The band stays this long after a run ends, then leaves.
const SHOW_DONE_MS = 60_000
// A run whose reporter has written nothing for this long is drawn as stalled,
// and past the second figure it is no longer drawn.
const STALLED_MS = 2 * 60_000
const ABANDON_MS = 15 * 60_000

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

// The session's progress file, once the two variables are set.
let file: string | undefined

// The two variables go on Claude Code's own process, once, at session start:
// every command started after (a Bash or PowerShell call, a background task)
// hands them to Playwright, which adds the reporter to its config's. No command
// is rewritten, so the permission check and auto mode see it as written. A
// PW_TEST_REPORTER the person set already is left alone, and nothing followed.
async function setUp($: EngineInterface) {
  const env = await $.process.hookEnv()
  const root = $.plugin.root
  const sep = root.includes('\\') ? '\\' : '/'
  const reporter = `${root}${sep}hooks${sep}progress-reporter.mjs`
  const path = `${env.CLAUDE_PLUGIN_DATA}${sep}progress-${env.CLAUDE_CODE_SESSION_ID || 'session'}.json`

  const own = await $.env.get('PW_TEST_REPORTER')
  if (own !== undefined && own !== '' && own !== reporter) return
  const set = [await $.env.set('PW_TEST_REPORTER', reporter), await $.env.set('E2E_PROGRESS_FILE', path)]
  if (set.every(result => result.deny === undefined)) file = path
}

// The file as the reporter last wrote it: undefined while there is none.
async function readProgress($: EngineInterface, path: string): Promise<Progress | undefined> {
  const text = await $.fs.read(path).catch(() => undefined)
  if (text === undefined) return undefined
  try {
    const progress = JSON.parse(text) as Progress

    return progress?.version === 1 ? progress : undefined
  } catch {
    // Half a file cannot be read (a rename is atomic), but a hand-made one can.
    return undefined
  }
}

// A run is drawn while it goes on, and for a minute after it ends.
const isShown = (progress: Progress, now: number) => {
  const updated = Date.parse(progress.updatedAt ?? progress.startedAt)

  return now - updated <= (progress.status === 'done' ? SHOW_DONE_MS : ABANDON_MS)
}

// One look at the file: the band's values moved on, or the band gone.
async function poll($: EngineInterface) {
  if (file === undefined) return
  const progress = await readProgress($, file)
  const now = await $.clock.now()
  const last = await read($, progressAtom)

  if (progress === undefined || !isShown(progress, now)) {
    if (last !== null) await update($, progressAtom, () => null)

    return
  }
  if (last?.updatedAt !== progress.updatedAt || last?.status !== progress.status) {
    await update($, progressAtom, () => progress)
  }
  await update($, nowAtom, () => now)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await setUp($)
    // Every second: a file read, and a redraw only while a run is drawn.
    $.clock.every(1000, () => {
      void poll($).catch(() => {})
    })

    return started
  })

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
