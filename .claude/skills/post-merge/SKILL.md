---
name: post-merge
description: Use right after a claude-mods pull request is merged - the PR watcher (scripts/pr-watch.mjs) reports MERGED, or the user says "s'ha fusionat", "fusionada", "merged", "post-merge". Updates main, deletes the local branch, and reports each plugin's version on GitHub's main, its tag, and what Claude Code has installed.
---

# After a pull request is merged

The plugins are installed from the GitHub repository `l0cu/claude-mods`, never from a local
folder. So their versions and state are always checked against GitHub and against what Claude
Code has installed, never against this checkout.

## 1. Run the script

```sh
node scripts/post-merge.mjs <branch>    # default: the current branch
```

[`scripts/post-merge.mjs`](../../../scripts/post-merge.mjs) switches to `main`, pulls it
(`--ff-only`, pruning remote branches that are gone), deletes the local branch (`-d`, never
`-D`), and prints what came in. Then, read from GitHub with `gh api`: the commit `main` is at,
the version there of each plugin the marketplace lists, and whether the workflow has tagged it
(`<plugin>--v<version>`). Last,
it checks that this machine's Claude Code has the `claude-mods` marketplace from
`l0cu/claude-mods`, the commit its copy is at against GitHub's `main`, the installed version
of each plugin, and whether the plugin auto-update can run in this environment. It changes nothing on
GitHub, nor in Claude Code's files.

- **Exit code not 0**: it stopped at the repository step (changes left, a failed pull, a branch
  not merged) or could not read GitHub. Tell the user what it printed and wait; never force it.
- **Tag not there yet**: the `tag` job runs after the merge's checks; check again in a minute
  (`gh api repos/l0cu/claude-mods/git/ref/tags/<plugin>--v<version>`) before reporting it missing.

## 2. Report

In a few lines, in Catalan: what is on GitHub's `main` now, each plugin's version and its tag,
and what Claude Code has installed, as the script's last lines say. Do not suggest a manual
`/plugin marketplace update`: the plugins reach the machine through auto-update. If the script
says the marketplace does not come from the repository, tell the user and leave it: removing and
adding it again is theirs to do.
