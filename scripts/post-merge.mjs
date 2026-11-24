// The mechanical steps after a pull request is merged (.claude/skills/post-merge/SKILL.md):
// updates main, deletes the local branch, prunes remote branches that are gone, and reports the
// plugin version now on main and whether the workflow has tagged it, and where this machine's
// Claude Code reads the marketplace from (Claude Code's known_marketplaces.json and
// installed_plugins.json). Changes nothing on GitHub, nor in Claude Code's files.
// Ported from l0cu/trito's scripts/post-merge.mjs, without its issue, board and Actions-minutes
// steps: this repository has no issue board, and Actions are free on a public repository.
// Usage: node scripts/post-merge.mjs [<branch>]   (default: the current branch)
// Exits 1 when the repository step stops (changes left, pull failed, branch not merged).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PLUGIN = 'usage';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitFails(args) {
  try {
    git(...args);
    return null;
  } catch (err) {
    return (err.stderr || err.message).trim();
  }
}

// 1. The repository.

const branch = process.argv[2] ?? git('branch', '--show-current');
if (!branch || branch === 'main' || branch.startsWith('-')) fail('Usage: node scripts/post-merge.mjs <branch>   (not main)');

const changes = git('status', '--short');
if (changes) fail(`Changes left, nothing done (commit, stash or discard them first):\n${changes}`);

const before = git('rev-parse', 'main');
const switched = gitFails(['switch', 'main']) ?? gitFails(['pull', '--ff-only', '--prune']);
if (switched) fail(`Could not update main:\n${switched}`);

const others = git('log', '--first-parent', '--format=%h %s', `${before}..HEAD`)
  .split('\n')
  .filter((line) => line && !line.endsWith(`/${branch}`));
console.log(`main is at ${git('log', '-1', '--format=%h %s')}`);
console.log(others.length ? `Also came in:\n${others.map((l) => `  ${l}`).join('\n')}` : 'Nothing else came in.');

if (gitFails(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) !== null) {
  console.log(`No local branch ${branch}.`);
} else {
  // -d, never -D: it refuses a branch that is not merged.
  const refused = gitFails(['branch', '-d', branch]);
  // git's hints suggest -D: left out.
  if (refused) fail(`Branch ${branch} kept, not merged into main:\n${refused.split('\n').filter((l) => !l.startsWith('hint:')).join('\n')}`);
  console.log(`Deleted branch ${branch}.`);
}

// 2. The plugin version on main, and its tag (the workflow adds it a minute or so after the merge).

const { version } = JSON.parse(fs.readFileSync(`${PLUGIN}/.claude-plugin/plugin.json`, 'utf8'));
const tag = `${PLUGIN}--v${version}`;
gitFails(['fetch', '--quiet', '--tags', 'origin']);
const tagged = gitFails(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`]) === null;
console.log(`\n${PLUGIN} ${version} on main; tag ${tag}: ${tagged ? 'there' : 'not yet (the workflow adds it after the merge)'}`);

// 3. Where this machine's Claude Code reads the marketplace from, and what it has installed.

const pluginsDir = path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'plugins');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pluginsDir, file), 'utf8'));
  } catch {
    return null;
  }
}

const marketplaceName = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8')).name;
const entry = readJson('known_marketplaces.json')?.[marketplaceName];
const installed = readJson('installed_plugins.json')?.plugins?.[`${PLUGIN}@${marketplaceName}`]?.map((i) => i.version) ?? [];
const installedNote = installed.length ? `installed: ${PLUGIN} ${[...new Set(installed)].join(', ')}` : `${PLUGIN} not installed`;
const source = entry?.source ?? {};
const samePath = (p) => p && path.resolve(p).toLowerCase() === path.resolve('.').toLowerCase();

if (!entry) {
  console.log(`Marketplace ${marketplaceName} is not added on this machine (${installedNote}).`);
} else if (samePath(source.path) || samePath(entry.installLocation)) {
  console.log(`Marketplace ${marketplaceName} is read from this folder (${installedNote}): /reload-plugins in each open session loads it.`);
} else {
  const at = entry.installLocation && gitFails(['-C', entry.installLocation, 'rev-parse', 'HEAD']) === null
    ? git('-C', entry.installLocation, 'rev-parse', 'HEAD')
    : null;
  const current = at === git('rev-parse', 'HEAD');
  const from = source.repo ?? source.url ?? source.path ?? source.source ?? 'elsewhere';
  console.log(`Marketplace ${marketplaceName} comes from ${from}, its copy at ${at ? at.slice(0, 7) : 'an unknown commit'}${current ? ', the same as main' : ', not main yet'} (${installedNote}).`);
  if (!current) {
    console.log(entry.autoUpdate
      ? `Auto-update is on: its next pass brings it in, or /plugin marketplace update ${marketplaceName} does it now.`
      : `Auto-update is off: /plugin marketplace update ${marketplaceName} brings it in.`);
  }
  console.log('Then /reload-plugins in each open session loads it.');
}
