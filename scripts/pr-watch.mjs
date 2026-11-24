// Watches an open pull request (CLAUDE.md, "Pull requests"): every minute it reads the PR's state
// and the checks of its last commit, and prints one line per event, for an agent to read as a
// notice (Claude Code: the Monitor tool):
//   CHECKS PASS <commit> | <n> checks             every check of that commit finished and passed
//   CHECKS FAIL <commit> | <name> (<bucket>) <link>; …   one failed or was cancelled
//   NO CHECKS <commit> | none after 15 min       that commit has no check (a draft, no workflow)
//     (each once per commit and result: a new push, or a re-run job, reports again)
//   PR #<n> MERGED | PR #<n> CLOSED              and it stops (exit 0)
//   ERROR …                                      5 gh errors in a row (expired login, API down), stops (exit 1)
//   TIMEOUT …                                    12 h after it first started, stops (exit 0)
// What it reported, and when it started, is kept in a file in the repository's .git folder (not
// a fixed name in a shared temp folder, which another user could plant): when the tool that runs
// it stops it and starts it again, it repeats nothing. It never runs post-merge itself: that
// switches to main and deletes the branch, which the agent does when it is not in the middle of
// other work. PR_WATCH_INTERVAL sets the seconds between polls (default 60).
// Ported from l0cu/trito's scripts/pr-watch.mjs.
// Usage: node scripts/pr-watch.mjs <pr number>   (exit 2: bad usage or no signed-in gh)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'l0cu/claude-mods';
const INTERVAL = Number(process.env.PR_WATCH_INTERVAL || 60) * 1000;
const LIMIT = 12 * 60 * 60 * 1000;
const NO_CHECKS_AFTER = 15 * 60 * 1000;
const MAX_ERRORS = 5;

const [n, ...rest] = process.argv.slice(2);
if (!/^\d+$/.test(n ?? '') || rest.length) {
  console.error('Usage: node scripts/pr-watch.mjs <pr number>');
  process.exit(2);
}

// gh on PATH, or where GitHub CLI installs on Windows (as scripts/post-merge.mjs).
function findGh() {
  const candidates = ['gh'];
  if (process.platform === 'win32') candidates.push(path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'GitHub CLI', 'gh.exe'));
  for (const gh of candidates) {
    const r = spawnSync(gh, ['auth', 'status'], { stdio: 'ignore' });
    if (!r.error) return r.status === 0 ? gh : null;
  }
  return null;
}
const GH = findGh();
if (!GH) {
  console.error('No signed-in gh: cannot watch the pull request.');
  process.exit(2);
}

const gitDir = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).stdout?.trim();
if (!gitDir) {
  console.error('Not in a git repository: no place for the watcher state.');
  process.exit(2);
}
const stateFile = path.join(gitDir, `claude-mods-pr-watch-${n}.json`);
/**
 * started: first run; reported: the last commit and checks result reported; noChecks: the last
 * commit reported without checks; head/since: the last commit seen and when.
 */
function load() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return { started: Date.now(), reported: null, noChecks: null, head: null, since: 0 };
  }
}
const state = load();
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state));
save();

/** Runs gh; `gh pr checks` exits non-zero while checks are pending or failed, so the code is not an error by itself. */
function gh(args) {
  const r = spawnSync(GH, [...args, '-R', REPO], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error) throw r.error;
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
}

/** { state: OPEN | MERGED | CLOSED, commit } */
function view() {
  const r = gh(['pr', 'view', n, '--json', 'state,headRefOid']);
  if (r.code !== 0 || !r.out.startsWith('{')) throw new Error(r.err || `gh pr view exited ${r.code}`);
  const v = JSON.parse(r.out);
  return { state: v.state, commit: v.headRefOid.slice(0, 7) };
}

/** The checks of the PR's last commit: [{ name, bucket, link }], [] when none is reported yet. */
function checks() {
  const r = gh(['pr', 'checks', n, '--json', 'name,bucket,link']);
  if (r.out.startsWith('[')) return JSON.parse(r.out);
  if (/no checks reported/i.test(r.err)) return [];
  throw new Error(r.err || `gh pr checks exited ${r.code}`);
}

/** Ends the watch; the state file goes, unless it stopped on errors and may be started again. */
function stop(code, line, keepState = false) {
  console.log(line);
  if (!keepState) fs.rmSync(stateFile, { force: true });
  process.exit(code);
}

let errors = 0;
for (;;) {
  if (Date.now() - state.started > LIMIT) stop(0, `TIMEOUT: PR #${n} is still open after 12 h`);
  try {
    const pr = view();
    const list = checks();
    errors = 0;
    if (state.head !== pr.commit) Object.assign(state, { head: pr.commit, since: Date.now() });
    // A re-run job gets a new link, so the same commit with a new result is reported again.
    const result = `${pr.commit} ${list.map((c) => `${c.name}:${c.bucket}:${c.link}`).sort().join(' ')}`;
    if (state.reported !== result) {
      if (list.length && !list.some((c) => c.bucket === 'pending')) {
        const failed = list.filter((c) => c.bucket === 'fail' || c.bucket === 'cancel');
        console.log(failed.length
          ? `CHECKS FAIL ${pr.commit} | ${failed.map((c) => `${c.name} (${c.bucket}) ${c.link}`).join('; ')}`
          : `CHECKS PASS ${pr.commit} | ${list.length} checks`);
        state.reported = result;
      } else if (!list.length && state.noChecks !== pr.commit && Date.now() - state.since > NO_CHECKS_AFTER) {
        console.log(`NO CHECKS ${pr.commit} | none after 15 min`);
        state.noChecks = pr.commit;
      }
    }
    save();
    if (pr.state !== 'OPEN') stop(0, `PR #${n} ${pr.state}`);
  } catch (err) {
    if (++errors >= MAX_ERRORS) stop(1, `ERROR: ${MAX_ERRORS} gh errors in a row watching PR #${n}: ${err.message}`, true);
  }
  await new Promise((resolve) => setTimeout(resolve, INTERVAL));
}
