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

1. Change the plugin under `usage/` and run its tests:
   `claude plugin test usage`.
2. Raise `version` in `usage/.claude-plugin/plugin.json`: the last number for a
   fix (0.6.4 → 0.6.5), the middle one for a feature (0.6.x → 0.7.0). Claude
   Code only updates a plugin whose version changed.
3. Add the change to `CHANGELOG.md`.
4. Commit, tag `usage-v<version>`, and push with tags:
   `git push --follow-tags`.

## License

MIT, see [LICENSE](LICENSE).
