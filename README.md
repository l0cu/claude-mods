# claude-mods

**English** · [Català](README.ca.md)

A Claude Code plugin marketplace with one plugin so far: **usage**.

## usage

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

### What it reads and sends

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
- **Code:** one readable TypeScript file, `usage/hooks/register.tsx`.
  `claude plugin validate ./usage` lists every hook and call it makes.

## Install

This repository is private: you need access to it on GitHub, and git on your
computer set up to clone it (SSH key or `gh auth login`).

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

## Releasing a new version (maintainers)

`main` is what users get, from this marketplace and from the plugin directory,
so changes reach it only through a pull request.

1. On a branch, change the plugin under `usage/` and run its tests:
   `claude plugin test usage`.
2. Raise `version` in `usage/.claude-plugin/plugin.json`: the last number for a
   fix (0.6.4 → 0.6.5), the middle one for a feature (0.6.x → 0.7.0). Claude
   Code only updates a plugin whose version changed.
3. Add a `## usage <version>` section to `CHANGELOG.md`.
4. Open a pull request. The `plugin` workflow validates the marketplace and the
   plugin (also against the plugin directory's checks), runs the tests, and
   fails if the plugin changed without a new version and its CHANGELOG entry.
5. Merge it. The workflow tags the commit `usage--v<version>`, and the plugin
   directory picks the new version up from `main` by itself.

## License

MIT, see [LICENSE](LICENSE).
