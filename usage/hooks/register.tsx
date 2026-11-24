import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { ModelWindow, UsageWindow } from '../types'

// Change the tag when a window's fields change: it declines what an earlier
// version stored, which outlives a reload.
const limitsAtom = atom({ plugin: 'usage', key: 'limits' } as const, [], {
  shape: 'limits-1',
})
// The weekly window Fable has of its own while its promotion runs: null once
// the account's usage rows stop naming one, and its bar leaves with it.
const modelAtom = atom({ plugin: 'usage', key: 'model' } as const, null)
// The clock the countdowns are drawn from: moved with each new reading of the
// limits, so the renew times are worked out again on every turn that consumes.
const nowAtom = atom({ plugin: 'usage', key: 'now' } as const, 0)

// The engine hands a mod the 5-hour and the weekly window alone. A model's own
// weekly window is a row of the account's usage endpoint, asked with the
// session's credential, which stays with the engine ($.session.authorize).
// The address is written at the call itself, the one request this mod makes.
// The endpoint answers 429 to a client that asks often.
const ASK_EVERY_MS = 5 * 60_000
const MODEL = /^fable\b/i

type UsageRow = {
  kind?: unknown
  percent?: unknown
  resets_at?: unknown
  scope?: { model?: { display_name?: unknown } | null } | null
}

const toWindows = (limits: readonly SessionRateLimit[]): UsageWindow[] =>
  limits.map(({ kind, percentUsed, resetsAt }) => ({
    kind,
    percentUsed,
    resetsAt: resetsAt ?? null,
  }))

const pick = (limits: readonly UsageWindow[], kind: string) =>
  limits.find(limit => limit.kind === kind) ?? null

const clamp = (n: number) => Math.max(0, Math.min(100, n))

const ORANGE = '#F4900C'
const BLUE = '#55ACEE'
const PURPLE = '#AA8ED6'
const TRACK = 'inactive'
// The terminal's bar: a half block, more of it than any row is wide.
const LINE = '▄'.repeat(400)

// VS Code draws a mod's Text at the panel's own size whatever `size` asks, so
// there the band is one SVG: its figures at the size of the panel's
// "From the … plugin" mark (0.85em of a 13px panel) over a bar 4px thick.
const SVG_FONT = 11
const SVG_ROW = 22
const SVG_BAR = 4
// Two meters share a row: each 48% of it, 4% apart.
const SVG_HALF = 48
const SVG_GAP = 4

type Reading = Pick<UsageWindow, 'percentUsed' | 'resetsAt'> | null

type Meter = { name: string; window: Reading; color: string; isWeekly: boolean }

const xml = (text: string) =>
  text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

const share = (n: number) => Math.round(n * 100) / 100

// The desktop draws the SVG as an image too, but there `currentColor` does not
// follow the app's text colour: its figures and tracks take one of two inks,
// chosen by the colour scheme the app's page reports.
const INK_LIGHT = '#1F1F1E'
const INK_DARK = '#E8E6E1'
const INK_STYLE =
  `<style>.ink{fill:${INK_LIGHT}}` +
  `@media (prefers-color-scheme: dark){.ink{fill:${INK_DARK}}}</style>`
const DESKTOP_FONT = `system-ui, -apple-system, &#39;Segoe UI&#39;, sans-serif`

// The band as an SVG: one row per list of meters, its figures above its bar.
// Coordinates across are shares of the panel's width, which the surface gives
// the image; down, pixels. `isDesktop` swaps `currentColor` for the inks.
function bandSvg(rows: readonly (readonly Meter[])[], now: number, isDesktop: boolean) {
  const height = rows.length * SVG_ROW - 2
  const ink = isDesktop ? 'class="ink"' : 'fill="currentColor"'
  const parts = rows.flatMap((meters, row) => {
    const top = row * SVG_ROW
    const width = meters.length > 1 ? SVG_HALF : 100

    return meters.map(({ name, window, color, isWeekly }, i) => {
      const x = i * (SVG_HALF + SVG_GAP)
      const used = share((width * clamp(window?.percentUsed ?? 0)) / 100)

      return [
        isDesktop ? `<text ${ink} x="${x}%" y="${top + SVG_FONT}">` : `<text x="${x}%" y="${top + SVG_FONT}">`,
        `<tspan font-weight="600">${xml(name)}</tspan>`,
        `<tspan dx="6">${label(window)}</tspan>`,
        `<tspan dx="6" fill-opacity="0.65">↻ ${untilReset(window, now, isWeekly)}</tspan>`,
        '</text>',
        `<rect x="${x}%" y="${top + 15}" width="${width}%" height="${SVG_BAR}" rx="2" ${ink} fill-opacity="0.2"/>`,
        `<rect x="${x}%" y="${top + 15}" width="${used}%" height="${SVG_BAR}" rx="2" fill="${color}"/>`,
      ].join('')
    })
  })

  const group = isDesktop
    ? `<g fill="${INK_LIGHT}" font-family="${DESKTOP_FONT}" font-size="${SVG_FONT}">`
    : `<g fill="currentColor" font-size="${SVG_FONT}">`

  return {
    height,
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${height}">${isDesktop ? INK_STYLE : ''}${group}${parts.join('')}</g></svg>`,
  }
}

// What the SVG says, for a reader that cannot see it.
const bandAlt = (rows: readonly (readonly Meter[])[], now: number) =>
  rows
    .flat()
    .map(({ name, window, isWeekly }) => `${name} ${label(window)} ↻ ${untilReset(window, now, isWeekly)}`)
    .join(' · ')

const label = (window: Reading) =>
  window ? `${Math.round(clamp(window.percentUsed))}%` : '–%'

const two = (n: number) => String(n).padStart(2, '0')

// "2h 39m" for the 5-hour window, "6d 05h" for a weekly one.
const untilReset = (window: Reading, now: number, isWeekly: boolean) => {
  if (!window?.resetsAt || now === 0) return isWeekly ? '–d ––h' : '–h ––m'
  const minutes = Math.max(0, Math.round((Date.parse(window.resetsAt) - now) / 60000))
  if (isWeekly) {
    return `${Math.floor(minutes / 1440)}d ${two(Math.floor((minutes % 1440) / 60))}h`
  }

  return `${Math.floor(minutes / 60)}h ${two(minutes % 60)}m`
}

async function tick($: EngineInterface) {
  const now = await $.clock.now()
  await update($, nowAtom, () => now)
}

// The model's row as the endpoint has it now: null when it answered without
// one, undefined when it gave no answer to read.
async function askModelWindow($: EngineInterface): Promise<ModelWindow | null | undefined> {
  const auth = await $.session.authorize()
  if (auth?.kind !== 'bearer') return undefined

  const { ok, text } = await $.http.fetch('https://api.anthropic.com/api/oauth/usage', {
    auth: auth.handle,
    headers: { 'anthropic-beta': 'oauth-2025-04-20' },
  })
  if (!ok) return undefined

  const { limits } = JSON.parse(text) as { limits?: UsageRow[] | null }
  for (const row of Array.isArray(limits) ? limits : []) {
    const name = row?.scope?.model?.display_name
    if (row.kind !== 'weekly_scoped' || typeof name !== 'string' || !MODEL.test(name)) continue
    if (typeof row.percent !== 'number') continue

    return {
      name,
      percentUsed: row.percent,
      resetsAt: typeof row.resets_at === 'string' ? row.resets_at : null,
    }
  }

  return null
}

let askedAt = 0
let asking: Promise<void> | undefined

async function askAndStore($: EngineInterface) {
  const now = await $.clock.now()
  if (now - askedAt < ASK_EVERY_MS) return
  askedAt = now

  const model = await askModelWindow($)
  if (model !== undefined) await update($, modelAtom, () => model)
}

// One question at a time and one every five minutes at most. A question that
// fails changes nothing: the bar keeps its last reading.
function refreshModel($: EngineInterface) {
  asking ??= askAndStore($)
    .catch(() => {})
    .finally(() => {
      asking = undefined
    })

  return asking
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    const { rateLimits } = await $.session.usage()
    if (rateLimits.length > 0) {
      await update($, limitsAtom, () => toWindows(rateLimits))
    }
    await tick($)
    // Not awaited: the session does not wait on the network to start.
    void refreshModel($)

    return ran
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') && e.rateLimits.length > 0) {
      await update($, limitsAtom, () => toWindows(e.rateLimits))
      await tick($)
      await refreshModel($)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const limits = await read($, limitsAtom)
    const model = await read($, modelAtom)
    const now = await read($, nowAtom)
    const rows: Meter[][] = [
      [
        { name: '5h', window: pick(limits, 'five_hour'), color: ORANGE, isWeekly: false },
        { name: '7d', window: pick(limits, 'seven_day'), color: BLUE, isWeekly: true },
      ],
      ...(model ? [[{ name: model.name, window: model, color: PURPLE, isWeekly: true }]] : []),
    ]

    // VS Code and the desktop app draw the band as one SVG; the terminal (and
    // the mobile apps) as Box and Text.
    if (e.surface === 'vscode' || e.surface === 'desktop') {
      const { Box, Svg } = $.ui.resolve(e)
      const { source, height } = bandSvg(rows, now, e.surface === 'desktop')

      return (
        <Box flexDirection="column" width="100%">
          <Svg source={source} alt={bandAlt(rows, now)} height={height} />
        </Box>
      )
    }

    const { Box, Text } = $.ui.resolve(e)

    // One meter, growing to share its row's width, its figures above its bar
    // as in the SVG. A cell is the thinnest thing a terminal fills, so the bar
    // is a line of glyphs rather than a background: each part holds more of
    // them than any row is wide, wrapped, and cut to its first row.
    const meter = ({ name, window, color, isWeekly }: Meter) => {
      const used = Math.round(clamp(window?.percentUsed ?? 0))

      return (
        <Box flexDirection="column" flexGrow={1} width={0}>
          <Box flexDirection="row" columnGap={1}>
            <Text size="footnote" weight="semibold">{name}</Text>
            <Text size="footnote" tabular>{label(window)}</Text>
            <Text size="footnote" tabular dimColor>
              ↻ {untilReset(window, now, isWeekly)}
            </Text>
          </Box>
          <Box flexDirection="row" width="100%" height={1} overflow="hidden">
            {used > 0 ? (
              <Box width={`${used}%`} height={1} overflow="hidden">
                <Text color={color}>{LINE}</Text>
              </Box>
            ) : null}
            <Box flexGrow={1} width={0} height={1} overflow="hidden">
              <Text color={TRACK}>{LINE}</Text>
            </Box>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" width="100%">
        {rows.map(meters => (
          <Box flexDirection="row" width="100%" columnGap={3}>
            {meters.map(meter)}
          </Box>
        ))}
      </Box>
    )
  })
}
