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
tagged it (`usage--v<version>`). It changes nothing on GitHub.

- **Exit code not 0**: it stopped at the repository step (changes left, a failed pull, a branch
  not merged). Tell the user what it printed and wait; never force it.
- **Tag not there yet**: the `tag` job runs after the merge's checks; check again in a minute
  (`git fetch --tags && git tag -l "usage--v*"`) before reporting it missing.

## 2. Report

In a few lines, in Catalan: what is on `main` now, the plugin version and its tag, and that each
open Claude Code session needs `/reload-plugins` to load it (this machine's marketplace is read
from this folder).
