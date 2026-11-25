# E2E Progress Band

A yellow band above the prompt with the progress of a Playwright run started
from the session:

- the tests done of the total, over a yellow bar;
- failures (✘, in red), flaky and skipped tests;
- the time the run has taken, and the test running now.

When the run ends the band says how (`✔ passed`, `✘ failed`, `✘ timed out`,
`✘ interrupted`) and stays a minute. A run whose reporter has written nothing
for two minutes turns grey, marked `stalled?`, and the band leaves after
fifteen.

It draws as an SVG in VS Code and in Claude Code Desktop (following the app's
light or dark scheme), and as text with a bar in the terminal.

## How it works

At session start the plugin sets two variables on Claude Code's own process,
so every command started from the session afterwards inherits them: a Bash or
PowerShell call, a background task, `npm run e2e` or `npx playwright test`.

- `PW_TEST_REPORTER`: the plugin's reporter, `hooks/progress-reporter.mjs`.
  Playwright adds the reporter this variable names to the ones its config
  lists, so the project's own reporters print as before.
- `E2E_PROGRESS_FILE`: where that reporter writes the run's progress, one file
  per session in the plugin's data folder.

The band reads that file once a second. No project file and no command is
changed.

`PW_TEST_REPORTER` is an internal Playwright variable, not a documented one
(checked with Playwright 1.64.1). A later Playwright may drop it: the tests
then run as before, and the band stays empty.

If you have set `PW_TEST_REPORTER` yourself, the plugin leaves it alone and
draws nothing.

### A run in your own terminal

A run started outside the session does not have the variables. To see it in
the band, ask Claude in the session for the values of `PW_TEST_REPORTER` and
`E2E_PROGRESS_FILE`, and set both in your terminal before the run.

## What it reads and writes

- **Network:** none.
- **Files:** the reporter writes one small JSON file per session in the
  plugin's data folder (`progress-<session>.json`: the counts, the test running
  and the times); the plugin reads it and nothing else.
- **Environment:** the two variables above, set for the whole session.
- **Data kept:** the latest reading of the run and the current time, in Claude
  Code's state for the plugin (`e2e-progress.progress`, `e2e-progress.now`).
- **Code:** two readable files, `hooks/register.tsx` (the band) and
  `hooks/progress-reporter.mjs` (the reporter, no dependencies).
  `claude plugin validate` on this folder lists every hook and call it makes.

## Install

In Claude Code:

```
/plugin marketplace add l0cu/claude-mods
/plugin install e2e-progress@claude-mods
```

Then start a new session: the variables are set when a session starts.

## Update

```
/plugin marketplace update claude-mods
```

Then `/reload-plugins` in each open session. Enabling auto-update for the
marketplace in `/plugin` does the first step for you.

## Links

- Source: <https://github.com/l0cu/claude-mods>
- Changes: <https://github.com/l0cu/claude-mods/blob/main/CHANGELOG.md>
- Issues: <https://github.com/l0cu/claude-mods/issues>
- License: MIT
