// A Playwright reporter that writes a run's progress to a JSON file, for the band to read.
//
// The plugin adds it to a run through PW_TEST_REPORTER, which Playwright loads on top of the
// reporters its config names, and says where to write through E2E_PROGRESS_FILE. Without that
// variable it does nothing, so a run started some other way is left as it was.
import fs from 'node:fs';
import path from 'node:path';

const FILE = process.env.E2E_PROGRESS_FILE;

// A test whose attempt failed but will be retried is not finished yet: only its last attempt
// counts, under the outcome Playwright gives the test as a whole.
const OUTCOME = { expected: 'passed', flaky: 'flaky', unexpected: 'failed', skipped: 'skipped' };

export default class ProgressReporter {
  constructor() {
    this.state = {
      version: 1,
      status: 'running',
      result: null,
      total: 0,
      done: 0,
      passed: 0,
      failed: 0,
      flaky: 0,
      skipped: 0,
      current: null,
      startedAt: new Date().toISOString(),
      updatedAt: null,
    };
  }

  printsToStdio() {
    return false;
  }

  onBegin(_config, suite) {
    this.state.total = suite.allTests().length;
    this.write();
  }

  onTestBegin(test) {
    this.state.current = title(test);
    this.write();
  }

  onTestEnd(test, result) {
    const outcome = test.outcome();
    if (outcome === 'unexpected' && result.retry < test.retries) return;
    this.state.done++;
    this.state[OUTCOME[outcome] ?? 'failed']++;
    this.state.current = null;
    this.write();
  }

  onEnd(result) {
    this.state.status = 'done';
    this.state.result = result.status;
    this.state.current = null;
    // The last write must land: a reader holding the file open can make one rename fail.
    for (let i = 0; i < 5 && !this.write(); i++) sleep(100);
  }

  // Through a temporary file beside it and a rename, so a reader never sees half a file. A
  // rename that fails is left for the next event to redo.
  write() {
    if (!FILE) return true;
    this.state.updatedAt = new Date().toISOString();
    const tmp = `${FILE}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.state));
      fs.renameSync(tmp, FILE);
      return true;
    } catch {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {}
      return false;
    }
  }
}

// "startup.spec.mjs › closes and saves", the way Playwright's own reporters name a test.
function title(test) {
  const file = path.basename(test.location.file);
  return [file, ...test.titlePath().slice(3)].join(' › ');
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
