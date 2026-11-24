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
tagged it (`usage--v<version>`). Last, it checks that this machine's Claude Code has the
`claude-mods` marketplace from the GitHub repository (`l0cu/claude-mods`, never a local
folder), the commit its copy is at, whether auto-update is on, and the installed `usage`
version. It changes nothing on GitHub, nor in Claude Code's files.

- **Exit code not 0**: it stopped at the repository step (changes left, a failed pull, a branch
  not merged). Tell the user what it printed and wait; never force it.
- **Tag not there yet**: the `tag` job runs after the merge's checks; check again in a minute
  (`git fetch --tags && git tag -l "usage--v*"`) before reporting it missing.

## 2. Report

In a few lines, in Catalan: what is on `main` now, the plugin version and its tag, and what this
machine needs to load it, as the script's last lines say: the marketplace update (the next
auto-update pass, or `/plugin marketplace update claude-mods` now), then `/reload-plugins` in
each open session. If the script says the marketplace does not come from the repository, tell
the user and leave it: removing and adding it again is theirs to do.
