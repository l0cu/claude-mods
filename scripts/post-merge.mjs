// The mechanical steps after a pull request is merged (.claude/skills/post-merge/SKILL.md):
// updates main, deletes the local branch, prunes remote branches that are gone, and reports the
// version of each plugin the marketplace lists on main in the GitHub repository (read with gh,
// not from this checkout) and whether the workflow has tagged it, and whether this machine's
// Claude Code has the marketplace from the GitHub repository and at which commit (Claude Code's
// known_marketplaces.json and installed_plugins.json). Changes nothing on GitHub, nor in Claude
// Code's files.
// Ported from l0cu/trito's scripts/post-merge.mjs, without its issue, board and Actions-minutes
// steps: this repository has no issue board, and Actions are free on a public repository.
// Usage: node scripts/post-merge.mjs [<branch>]   (default: the current branch)
// Exits 1 when the repository step stops (changes left, pull failed, branch not merged).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

// 2. The plugins on main in the GitHub repository, which is what users install, and their tags
// (the workflow adds them a minute or so after the merge). Read from GitHub, not from this
// checkout: the marketplace's list of plugins, then each one's manifest.

// The plugin is installed from the GitHub repository, never from a local folder.
const REPO = 'l0cu/claude-mods';

function gh(...args) {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function ghJson(file, ref) {
  const content = gh(`repos/${REPO}/contents/${file}?ref=${ref}`, '--jq', '.content');
  return JSON.parse(Buffer.from(content, 'base64').toString('utf8'));
}

let mainSha;
let plugins;
try {
  mainSha = gh(`repos/${REPO}/commits/main`, '--jq', '.sha');
  plugins = ghJson('.claude-plugin/marketplace.json', mainSha).plugins.map((plugin) => {
    const folder = plugin.source.replace(/^\.\//, '');
    return { name: plugin.name, version: ghJson(`${folder}/.claude-plugin/plugin.json`, mainSha).version };
  });
} catch (err) {
  fail(`Could not read main from GitHub (${REPO}):\n${(err.stderr || err.message).trim()}`);
}
console.log(`\nGitHub ${REPO} main is at ${mainSha.slice(0, 7)}:`);
for (const { name, version } of plugins) {
  const tag = `${name}--v${version}`;
  let tagged = true;
  try {
    gh(`repos/${REPO}/git/ref/tags/${tag}`, '--silent');
  } catch {
    tagged = false;
  }
  console.log(`  ${name} ${version}; tag ${tag}: ${tagged ? 'there' : 'not yet (the workflow adds it after the merge)'}`);
}

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
const installedPlugins = readJson('installed_plugins.json')?.plugins ?? {};
const installedNote = plugins
  .map(({ name }) => {
    const versions = [...new Set((installedPlugins[`${name}@${marketplaceName}`] ?? []).map((i) => i.version))];
    return versions.length ? `installed: ${name} ${versions.join(', ')}` : `${name} not installed`;
  })
  .join('; ');
const source = entry?.source ?? {};
const fromRepo = source.source === 'github' && source.repo?.toLowerCase() === REPO;

if (!entry) {
  console.log(`Marketplace ${marketplaceName} is not added on this machine (${installedNote}): /plugin marketplace add ${REPO}.`);
} else if (!fromRepo) {
  const from = source.repo ?? source.url ?? source.path ?? source.source ?? 'an unknown source';
  console.log(`Marketplace ${marketplaceName} comes from ${from}, not from the repository ${REPO} (${installedNote}).`);
  console.log(`Remove it (/plugin marketplace remove ${marketplaceName}) and add it from the repository: /plugin marketplace add ${REPO}.`);
} else {
  const at = entry.installLocation && gitFails(['-C', entry.installLocation, 'rev-parse', 'HEAD']) === null
    ? git('-C', entry.installLocation, 'rev-parse', 'HEAD')
    : null;
  const current = at === mainSha;
  console.log(`Marketplace ${marketplaceName} comes from ${REPO}, Claude Code's copy at ${at ? at.slice(0, 7) : 'an unknown commit'}${current ? ', the same as GitHub main' : ', not GitHub main yet'} (${installedNote}).`);
  if (!current) {
    // Claude Code's plugin auto-update runs once, when a Claude Code process starts, and skips
    // itself under DISABLE_AUTOUPDATER (which Claude Code Desktop sets for its sessions) unless
    // FORCE_AUTOUPDATE_PLUGINS is set.
    const env = process.env;
    const skipped = (env.DISABLE_AUTOUPDATER || env.DISABLE_UPDATES) && !env.FORCE_AUTOUPDATE_PLUGINS;
    console.log(!entry.autoUpdate
      ? `Auto-update is off for ${marketplaceName}.`
      : skipped
        ? 'Auto-update is on for the marketplace, but this environment skips the plugin pass (DISABLE_AUTOUPDATER set, FORCE_AUTOUPDATE_PLUGINS not).'
        : 'Auto-update is on: the plugin pass runs when a Claude Code session starts.');
  }
}
