# claude-mods

A Claude Code plugin marketplace (`.claude-plugin/marketplace.json`) with one plugin, `usage`,
under `usage/`. What the plugin does, and how a version is released, is in
[README.md](README.md).

Talk to the user in Catalan. Code, commits, pull requests and the English docs stay in English.

## Pull requests

- `main` is protected: every change reaches it through a pull request whose `check` job
  passes. Work on a branch from an up-to-date `main`.
- A change under `usage/` raises `version` in `usage/.claude-plugin/plugin.json` and adds a
  `## usage <version>` section to `CHANGELOG.md`; CI fails the pull request otherwise.
- This repository commits as GitHub's noreply address (`user.email` in `.git/config`); never
  change it, nor the global git configuration.
- **Watch each pull request once it is open**, without being asked:
  `node scripts/pr-watch.mjs <n>`, started right after `gh pr create` and followed as an event
  stream (Claude Code: the `Monitor` tool, started again with the same command each time it
  expires; it keeps its state in `.git` and repeats no event). One line per event:
  - `CHECKS PASS` / `CHECKS FAIL` (with links), once per pushed commit: tell the user; fix a
    failure on the branch.
  - `NO CHECKS` after 15 min: say so.
  - `PR #<n> MERGED`: run the [`post-merge`](.claude/skills/post-merge/SKILL.md) skill straight
    away. `PR #<n> CLOSED`: say so. Either way it stops.
  - `ERROR` (5 `gh` errors in a row) or `TIMEOUT` (12 h): say so; start it again after an
    `ERROR` once its cause is fixed, never after `MERGED`, `CLOSED` or `TIMEOUT`.
- The user merges on GitHub. Never merge a pull request yourself.
