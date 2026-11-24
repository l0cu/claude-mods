---
name: post-merge
description: Use right after a claude-mods pull request is merged - the PR watcher (scripts/pr-watch.mjs) reports MERGED, or the user says "s'ha fusionat", "fusionada", "merged", "post-merge". Updates main, deletes the local branch, and reports the plugin version on main and its tag.
---

# After a pull request is merged

## 1. Run the script

```sh
node scripts/post-merge.mjs <branch>    # default: the current branch
```

[`scripts/post-merge.mjs`](../../../scripts/post-merge.mjs) switches to `main`, pulls it
(`--ff-only`, pruning remote branches that are gone), deletes the local branch (`-d`, never
`-D`), and prints what came in, the `usage` version now on `main`, and whether the workflow has
tagged it (`usage--v<version>`). Last, it says where this machine's Claude Code reads the
`claude-mods` marketplace from (this folder, or its own copy of the GitHub repository and the
commit that copy is at), whether auto-update is on, and the installed `usage` version. It
changes nothing on GitHub, nor in Claude Code's files.

- **Exit code not 0**: it stopped at the repository step (changes left, a failed pull, a branch
  not merged). Tell the user what it printed and wait; never force it.
- **Tag not there yet**: the `tag` job runs after the merge's checks; check again in a minute
  (`git fetch --tags && git tag -l "usage--v*"`) before reporting it missing.

## 2. Report

In a few lines, in Catalan: what is on `main` now, the plugin version and its tag, and what this
machine needs to load it, as the script's last lines say: only `/reload-plugins` in each open
session when the marketplace is read from this folder; otherwise first the marketplace update
(the next auto-update pass, or `/plugin marketplace update claude-mods` now), then
`/reload-plugins`.
