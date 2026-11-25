// Utility tests: YFM->PIPE table converter, the shared pipe-table serializer
// and the version comparison used by the update check.
//   npm run test:utils
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeYfmTables } from '../src/utils/yfmTable.ts';
import { rowsToPipeTable } from '../src/utils/pipeTable.ts';
import { isNewer, fetchLatestGitHubVersion } from '../src/utils/versionCheck.ts';

/** Asserts a table was converted 1:1 into the expected pipe table. */
function assertConverted(input: string, expected: string) {
  const { value, converted } = sanitizeYfmTables(input);
  assert.equal(converted, 1);
  assert.equal(value, expected);
}

/** Asserts the input is left untouched (kept as YFM or not a table at all). */
function assertUntouched(input: string) {
  assert.equal(sanitizeYfmTables(input).value, input);
}

// ── YFM → PIPE converter ────────────────────────────────────────────────────

test('converts the expanded sample from the user report', () => {
  assertConverted(
    `# Linux Commands

#|
||

Command

|

Description

||
||

Send-WakeOnLan -TargetAddress "f4:93:9f:f3:aa:7c"

|

Waik-up on LAN

||
||

ssh butchpro@10.0.12.102

|

Console Login

||
|#`,
    `# Linux Commands

| Command | Description |
| --- | --- |
| Send-WakeOnLan -TargetAddress "f4:93:9f:f3:aa:7c" | Waik-up on LAN |
| ssh butchpro@10.0.12.102 | Console Login |`,
  );
});

test('leaves fenced YFM examples untouched', () => {
  assertUntouched(`Example of YFM syntax:

\`\`\`
#|
|| a | b ||
|| c | d ||
|#
\`\`\`

Done.`);
});

test('converts a real table and leaves the fenced one alone', () => {
  assertConverted(
    `#|
|| Real | Table ||
|| 1 | 2 ||
|#

\`\`\`
#|
|| Fake | Example ||
|#
\`\`\``,
    `| Real | Table |
| --- | --- |
| 1 | 2 |

\`\`\`
#|
|| Fake | Example ||
|#
\`\`\``,
  );
});

test('keeps tables with row spans', () => {
  assertUntouched(`#|\n|| A | B |\n|| rowspan ^ | c |\n|| next | d |\n|#\n`);
});

test('keeps tables with column spans', () => {
  assertUntouched(`#|\n|| A | B | C |\n|| span ||\n|| x | y | z |\n|#\n`);
});

test('keeps tables with cell attributes', () => {
  assertUntouched(`#|\n|| Header | More |\n|| {align=right} val | x |\n|#\n`);
});

test('keeps tables with colour markup', () => {
  assertUntouched(`#|\n|| A |\n|| %%colored%% |\n|#\n`);
});

test('converts cells that contain braces', () => {
  assertConverted(
    `#|\n|| Cmd ||\n|| if ($x) { Do-Thing } ||\n|#\n`,
    `| Cmd |\n| --- |\n| if ($x) { Do-Thing } |\n`,
  );
});

test('keeps inline markup inside cells', () => {
  assertConverted(
    `#|\n|| Name | Note ||\n|| **bold** | a \`code\` span ||\n|#`,
    `| Name | Note |\n| --- | --- |\n| **bold** | a \`code\` span |`,
  );
});

test('passes plain markdown through unchanged', () => {
  const noTable = `# Notes\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n`;
  assert.equal(sanitizeYfmTables(noTable).value, noTable);
  assert.equal(sanitizeYfmTables(noTable).converted, 0);
});

// ── pipe-table serializer ───────────────────────────────────────────────────

test('escapes raw pipes in cell content', () => {
  assert.equal(
    rowsToPipeTable(['cmd'], [['Get-Item | Select']]),
    '| cmd |\n| --- |\n| Get-Item \\| Select |',
  );
});

// ── versionCheck / update check ─────────────────────────────────────────────

test('compares dot versions numerically', () => {
  assert.equal(isNewer('1.0.4', '1.0.5'), true);
  assert.equal(isNewer('1.0.4', '1.0.4'), false);
  assert.equal(isNewer('1.0.5', '1.0.4'), false);
  assert.equal(isNewer('1.0.9', '1.1.0'), true);
  assert.equal(isNewer('1.9.9', '2.0.0'), true);
  assert.equal(isNewer('1.0', '1.0.1'), true);
  assert.equal(isNewer('1.0.1', '1.0'), false);
});

test('live GitHub release tag has a numeric format', async (t) => {
  const latest = await fetchLatestGitHubVersion();
  if (latest === null) {
    t.skip('no network / rate limited');
    return;
  }
  assert.equal(/^\d+(\.\d+)*$/.test(latest), true);
});
