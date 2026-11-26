# claude-mods

**English** · [Català](README.ca.md)

A Claude Code plugin marketplace with **two plugins**. Each one is installed on
its own: install either or both.

| Plugin | What it shows | Install |
| --- | --- | --- |
| **[usage](#usage)** | A band above the prompt with your plan's usage: the 5-hour and weekly windows, and Fable's | `/plugin install usage@claude-mods` |
| **[e2e-progress](#e2e-progress)** | A yellow band above the prompt with the progress of a Playwright run | `/plugin install e2e-progress@claude-mods` |

- [Quick start](#quick-start): add the marketplace, install, update
- [usage](#usage): what it shows, what it reads and sends, install or update it
  by asking Claude
- [e2e-progress](#e2e-progress): what it shows, how it works, install it by
  asking Claude
- [Releasing a new version (maintainers)](#releasing-a-new-version-maintainers)

## Quick start

### Install

In Claude Code, add the marketplace once, then install the plugins you want:

```
/plugin marketplace add l0cu/claude-mods
/plugin install usage@claude-mods
/plugin install e2e-progress@claude-mods
```

Then `/reload-plugins`, or start a new session (e2e-progress sets its
variables when a session starts).

Each plugin also has a prompt you can paste into a session so Claude installs
it and checks it: see [usage](#install-usage-from-github-by-asking-claude) and
[e2e-progress](#install-e2e-progress-by-asking-claude).

### Update

One command updates both plugins:

```
/plugin marketplace update claude-mods
```

Then `/reload-plugins` in each open session. Enabling auto-update for the
marketplace in `/plugin` does the first step for you.

The terminal, VS Code and Claude Code Desktop share one install (under
`~/.claude`), so installing or updating once from any of them is enough.

---

## usage

`usage@claude-mods` · folder [`usage/`](usage/) · [CHANGELOG](CHANGELOG.md)

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

### Install usage from GitHub by asking Claude

Paste this into a session on any machine. If `usage` is installed from
somewhere else (a local folder, another marketplace or repository), Claude
uninstalls it and installs it again from GitHub; it asks you before removing a
marketplace.

<details>
<summary>Prompt: install <code>usage</code> from GitHub</summary>

```text
Make sure the `usage` plugin is installed from the `claude-mods` marketplace on
GitHub (l0cu/claude-mods), and if it comes from anywhere else, uninstall it and
install it from there. Use only the `claude plugin` command from the shell; do
not edit anything under `~/.claude` by hand.

1. Run `claude --version`. If `claude` is not on the PATH, stop and tell me to
   type these myself, then `/reload-plugins`:
     /plugin marketplace add l0cu/claude-mods
     /plugin install usage@claude-mods
2. Run `claude plugin list --json` and `claude plugin marketplace list --json`.
   Note every installed plugin whose `id` is `usage@<marketplace>`, with its
   `version` and `scope`, and the source of each of those marketplaces. An
   entry points to GitHub when its marketplace is `claude-mods` and that
   marketplace has `source: github` and `repo: l0cu/claude-mods`.
3. If the only entry is `usage@claude-mods` and it points to GitHub, tell me
   it is already installed from GitHub, with its version, and stop: change
   nothing. If there is no entry at all, go to step 6.
4. If the `claude-mods` marketplace exists but does not point to GitHub (a
   local folder, another repository, a URL), show me its source and every
   other plugin installed from it (`<name>@claude-mods`), and ask me before
   changing anything: it has to be removed and added again from GitHub. Wait
   for my reply; if I say no, stop.
5. Uninstall every entry that does not point to GitHub:
   `claude plugin uninstall usage@<marketplace> --scope <its scope>`. If its
   scope is not `user`, `project` or `local`, or the command fails, show me
   the entry and the error and stop.
6. If `claude-mods` does not point to GitHub, run
   `claude plugin marketplace remove claude-mods` (only if I said yes in step
   4). If it is missing now, run `claude plugin marketplace add l0cu/claude-mods`.
   Then run `claude plugin marketplace update claude-mods`.
7. Run `claude plugin install usage@claude-mods`. If a command asks you to
   confirm a marketplace-declared command, do not pass `-y`: show it to me and
   wait.
8. Run both lists again and check: `claude-mods` has `source: github` and
   `repo: l0cu/claude-mods`; the only `usage@…` entry is `usage@claude-mods`,
   with `enabled: true` and the `version` in
   `<claude-mods installLocation>/usage/.claude-plugin/plugin.json`.
9. Tell me what you found, what you uninstalled or removed, and the version
   installed now. If step 4 listed other plugins, tell me to install them
   again from GitHub. Remind me to run `/reload-plugins` in each open session
   (terminal, VS Code and Desktop), or to open new ones, since Claude cannot
   type that command, and to check in `/plugin` that auto-update is on for
   `claude-mods`.
```

</details>

### Update usage by asking Claude

Paste this into a session; once, from any of them, is enough.

<details>
<summary>Prompt: update <code>usage</code></summary>

```text
Update the `usage` plugin from the `claude-mods` marketplace (GitHub:
l0cu/claude-mods) to the latest version on `main`, and check it. Use only the
`claude plugin` command from the shell; do not edit anything under `~/.claude`
by hand.

1. Run `claude --version`. If `claude` is not on the PATH, stop and tell me to
   type `/plugin marketplace update claude-mods` and then `/reload-plugins`
   myself.
2. Run `claude plugin marketplace list --json` and check that `claude-mods` is
   there with `source: github` and `repo: l0cu/claude-mods`. If it is missing,
   add it with `claude plugin marketplace add l0cu/claude-mods`. If it points
   somewhere else, stop and tell me.
3. Run `claude plugin marketplace update claude-mods`.
4. Read `version` from
   `<claude-mods installLocation>/usage/.claude-plugin/plugin.json`: that is
   the version on GitHub now.
5. Run `claude plugin list --json` and look for `usage@claude-mods`:
   - missing: `claude plugin install usage@claude-mods`
   - an older version: `claude plugin update usage@claude-mods`
   - the same version: nothing to do.
   If a command asks you to confirm a marketplace-declared command, do not pass
   `-y`: show it to me and wait.
6. Run `claude plugin list --json` again and check that `usage@claude-mods` has
   the version from step 4 and `enabled: true`.
7. Tell me the version before, the version now and the version on GitHub.
   Remind me to run `/reload-plugins` in each open session (terminal, VS Code
   and Desktop), or to open new ones: Claude cannot type that command for me.
```

</details>

---

## e2e-progress

`e2e-progress@claude-mods` · folder [`e2e-progress/`](e2e-progress/) ·
[CHANGELOG](CHANGELOG.md) · [full README](e2e-progress/README.md)

A yellow band above the prompt with the progress of a Playwright run started
from the session: the tests done of the total, failures, flaky and skipped
tests, the share done, the time and the test running now. When the run ends
the band says how and stays a minute; a run that has written nothing for two
minutes turns grey, marked `stalled?`.

### How it works

At session start the plugin sets `PW_TEST_REPORTER` and `E2E_PROGRESS_FILE` on
Claude Code's own process, so every command started from the session passes
them to Playwright, which adds the plugin's reporter to the ones its config
lists. No project file and no command is changed. `PW_TEST_REPORTER` is an
internal Playwright variable, not a documented one (checked with Playwright
1.64.1).

It makes no network request, and writes one small progress file per session in
its data folder. The details, and how to see a run from your own terminal, are
in [e2e-progress/README.md](e2e-progress/README.md).

### Install e2e-progress by asking Claude

Paste this into a session on any machine. Claude cannot type `/reload-plugins`,
so it asks you to, then checks whether the session took the plugin or a new
one is needed.

<details>
<summary>Prompt: install <code>e2e-progress</code></summary>

```text
Install the `e2e-progress` plugin from the `claude-mods` marketplace (GitHub:
l0cu/claude-mods), the latest version on `main`, and check that it works in
this session. Use only the `claude plugin` command from the shell; do not edit
anything under `~/.claude` by hand.

1. Run `claude --version`. If `claude` is not on the PATH, stop and tell me to
   type these myself, then `/reload-plugins`:
     /plugin marketplace add l0cu/claude-mods
     /plugin install e2e-progress@claude-mods
2. Run `claude plugin marketplace list --json` and look for `claude-mods`:
   - missing: `claude plugin marketplace add l0cu/claude-mods`
   - there with `source: github` and `repo: l0cu/claude-mods`: go on
   - pointing anywhere else: stop and tell me.
3. Run `claude plugin marketplace update claude-mods`.
4. Read `version` from
   `<claude-mods installLocation>/e2e-progress/.claude-plugin/plugin.json`:
   that is the version on GitHub now.
5. Run `claude plugin list --json` and look for `e2e-progress@claude-mods`:
   - missing: `claude plugin install e2e-progress@claude-mods`
   - an older version: `claude plugin update e2e-progress@claude-mods`
   - the same version: nothing to install.
   If a command asks you to confirm a marketplace-declared command, do not pass
   `-y`: show it to me and wait.
6. Run `claude plugin list --json` again and check that
   `e2e-progress@claude-mods` has the version from step 4 and `enabled: true`.
7. Tell me the version before, the version now and the version on GitHub.
   Then ask me to type `/reload-plugins` in this session and reply "done":
   you cannot type that command yourself. Wait for my reply.
8. When I reply, run a new shell command that prints the environment variables
   `PW_TEST_REPORTER` and `E2E_PROGRESS_FILE`:
   - both set, `PW_TEST_REPORTER` ending in
     `e2e-progress/<version from step 4>/hooks/progress-reporter.mjs` (either
     slash) and `E2E_PROGRESS_FILE` ending in `progress-<this session's id>.json`:
     tell me the plugin is active here, and that a Playwright run I start from
     this session (`npx playwright test`, `npm run e2e`…) shows a yellow band
     above the prompt.
   - not set, or pointing at another version: tell me the plugin is installed
     but this session has not taken it, and that I must open a new session
     (terminal, VS Code or Desktop) for it to be active.
   Do not set those variables yourself: the band reads the file only when the
   plugin set them.
```

</details>

---

## Releasing a new version (maintainers)

`main` is what users get, from this marketplace and from the plugin directory,
so changes reach it only through a pull request.

Each plugin lives in its own folder (`usage/`, `e2e-progress/`), the one its
entry in `.claude-plugin/marketplace.json` names; a new plugin is added there.

1. On a branch, change the plugin in its folder and run its tests:
   `claude plugin test <plugin>`.
2. Raise `version` in `<plugin>/.claude-plugin/plugin.json`: the last number
   for a fix (0.6.4 → 0.6.5), the middle one for a feature (0.6.x → 0.7.0).
   Claude Code only updates a plugin whose version changed.
3. Add a `## <plugin> <version>` section to `CHANGELOG.md`. If what the plugin
   does changed, update `<plugin>/README.md` too: only the plugin's folder is
   installed, so that is the README Claude Code shows for the installed plugin.
4. Open a pull request. The `plugin` workflow validates the marketplace and
   every plugin it lists (also against the plugin directory's checks), runs
   their tests, and fails if a plugin changed without a new version and its
   CHANGELOG entry (a new plugin needs only its entry).
5. Merge it. The workflow tags each new version `<plugin>--v<version>`, and the
   plugin directory picks it up from `main` by itself.

## License

MIT, see [LICENSE](LICENSE).
