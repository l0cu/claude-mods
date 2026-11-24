# Usage Band

A band above the prompt with your plan's usage:

- **5h** (orange): the 5-hour window, with the time left until it renews.
- **7d** (blue): the weekly window, with the days and hours until it renews.
- **Fable** (purple): Fable's own weekly window, shown only while the account
  has one.

It draws as an SVG in VS Code and in Claude Code Desktop (following the app's
light or dark scheme), and as text with thin bars in the terminal.

The 5h and 7d figures come from the session itself. The Fable bar asks the
account's usage endpoint with the session's own credential, at most once every
five minutes; that endpoint is not a documented plugin API and may change.

## What it reads and sends

- **Network:** one request, `GET https://api.anthropic.com/api/oauth/usage`, at
  session start and then at most once every five minutes. It sends no body; the
  session's own credential is attached by Claude Code (`$.session.authorize`),
  and the plugin never sees or stores it. Nothing is sent anywhere else, and
  `plugin.json` declares `api.anthropic.com` as its only host
  (`network.hosts`).
- **Data kept:** only the latest readings (the usage windows, Fable's weekly
  row and the current time), in Claude Code's state for the plugin
  (`usage.limits`, `usage.model`, `usage.now`). The plugin writes no files of
  its own, and nothing leaves your computer except that request.
- **Code:** one readable TypeScript file, `hooks/register.tsx`.
  `claude plugin validate` on this folder lists every hook and call it makes.

## Install

In Claude Code:

```
/plugin marketplace add l0cu/claude-mods
/plugin install usage@claude-mods
```

Then `/reload-plugins`, or start a new session.

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
