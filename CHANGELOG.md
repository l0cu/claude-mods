# Changelog

Versions of the plugins in this marketplace, each under `## <plugin>
<version>`. Each release is tagged `<plugin>--v<version>` (`usage-v<version>`
up to usage 0.6.4).

## e2e-progress 0.1.2

- The share done, as a whole number rounded down (`25%`), left of the time,
  as `usage` writes its meters: 100% only once every test is done.

## e2e-progress 0.1.1

- The test running is on a line of its own under the bar, and wraps: a long
  name was cut at the band's edge, since an SVG cannot measure its text.

## e2e-progress 0.1.0

- First version: a yellow band above the prompt with the progress of a
  Playwright run started from the session (tests done of the total, failures,
  flaky and skipped tests, the time and the test running), drawn as an SVG in
  VS Code and Claude Code Desktop and as text with a bar in the terminal. It
  stays a minute after the run ends, and turns grey as "stalled?" when the run
  has written nothing for two minutes.
- Its own Playwright reporter is added to the run through `PW_TEST_REPORTER`,
  which the plugin sets with `E2E_PROGRESS_FILE` for the whole session at its
  start; no project file and no command is changed.

## usage 0.6.8

- The plugin folder has its own `README.md`, so the installed plugin's page in
  Claude Code Desktop shows it instead of only the one-line description. No
  change to the band.

## usage 0.6.7

- The one network request is written at the call with its fixed address, and
  `plugin.json` declares its host (`network.hosts`: `api.anthropic.com`).
  No change to the band.

## usage 0.6.6

- Display name "Usage Band". The plugin's `name` stays `usage`, so installs
  (`usage@claude-mods`) are unchanged.

## usage 0.6.5

- Manifest: homepage, repository and support links, for the plugin directory
  listing. No change to the band.
- Icon (`.claude-plugin/icon.png`): the band's 5h and 7d bars under the word
  USAGE.

## usage 0.6.4

- Terminal: each meter shows its figures above a thin bar drawn with half-block
  glyphs, matching the SVG layout of VS Code and the desktop app.

## usage 0.6.0

- Claude Code Desktop draws the band as the same SVG as VS Code, its text
  colour following the app's light or dark scheme.

## usage 0.5.0

- Fable's own weekly bar (purple) while its promotion runs.
- VS Code draws the band as one SVG.
