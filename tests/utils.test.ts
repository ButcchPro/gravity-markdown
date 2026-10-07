// Utility tests runnable via Node type-stripping:
//   npm run test:utils
// Covers the YFM->PIPE table converter, the shared pipe-table serializer
// and the version comparison used by the update check.
import { sanitizeYfmTables } from '../src/utils/yfmTable.ts';
import { rowsToPipeTable } from '../src/utils/pipeTable.ts';
import { isNewer, fetchLatestGitHubVersion } from '../src/utils/versionCheck.ts';

let passed = 0;
let failed = 0;

function check(name: string, input: string, expect: string | null) {
  const { value, converted, kept } = sanitizeYfmTables(input);
  if (expect === null) {
    if (value === input) {
      passed += 1; console.log(`PASS (kept)  ${name} (kept=${kept})`);
    } else {
      failed += 1; console.log(`FAIL (kept)  ${name}`, { converted, kept, value });
    }
  } else if (converted === 1 && value === expect) {
    passed += 1; console.log(`PASS (conv)  ${name}`);
  } else {
    failed += 1; console.log(`FAIL (conv)  ${name}\n--- expected ---\n${expect}\n--- actual ---\n${value}`);
  }
}

function checkEq(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    passed += 1; console.log(`PASS         ${name}`);
  } else {
    failed += 1; console.log(`FAIL         ${name}: expected=${String(expected)} actual=${String(actual)}`);
  }
}

// ── YFM → PIPE converter ────────────────────────────────────────────────────

check('expanded sample (user report)', `# Linux Commands

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
|#`, `# Linux Commands

| Command | Description |
| --- | --- |
| Send-WakeOnLan -TargetAddress "f4:93:9f:f3:aa:7c" | Waik-up on LAN |
| ssh butchpro@10.0.12.102 | Console Login |`);

check('fenced YFM example untouched', `Example of YFM syntax:

\`\`\`
#|
|| a | b ||
|| c | d ||
|#
\`\`\`

Done.`, null);

check('mixed: real table converted, fenced left alone', `#|
|| Real | Table ||
|| 1 | 2 ||
|#

\`\`\`
#|
|| Fake | Example ||
|#
\`\`\``, `| Real | Table |
| --- | --- |
| 1 | 2 |

\`\`\`
#|
|| Fake | Example ||
|#
\`\`\``);

check('rowspan kept', `#|\n|| A | B |\n|| rowspan ^ | c |\n|| next | d |\n|#\n`, null);
check('colspan kept', `#|\n|| A | B | C |\n|| span ||\n|| x | y | z |\n|#\n`, null);
check('cell attr kept', `#|\n|| Header | More |\n|| {align=right} val | x |\n|#\n`, null);
check('colors kept', `#|\n|| A |\n|| %%colored%% |\n|#\n`, null);
check('code with {} still converts', `#|\n|| Cmd ||\n|| if ($x) { Do-Thing } ||\n|#\n`, `| Cmd |\n| --- |\n| if ($x) { Do-Thing } |\n`);
check('inline markup survives', `#|\n|| Name | Note ||\n|| **bold** | a \`code\` span ||\n|#`, `| Name | Note |\n| --- | --- |\n| **bold** | a \`code\` span |`);

const noTable = `# Notes\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n`;
checkEq('plain markdown passthrough', sanitizeYfmTables(noTable).value, noTable);
checkEq('no YFM table: converted=0', sanitizeYfmTables(noTable).converted, 0);

// ──_pipeTable serializer ────────────────────────────────────────────────────

checkEq('raw | escaped on output', rowsToPipeTable(['cmd'], [['Get-Item | Select']]), '| cmd |\n| --- |\n| Get-Item \\| Select |');

// ── versionCheck / update check ─────────────────────────────────────────────

checkEq('isNewer old→new', isNewer('1.0.4', '1.0.5'), true);
checkEq('isNewer equal', isNewer('1.0.4', '1.0.4'), false);
checkEq('isNewer new→old', isNewer('1.0.5', '1.0.4'), false);
checkEq('isNewer minor', isNewer('1.0.9', '1.1.0'), true);
checkEq('isNewer major', isNewer('1.9.9', '2.0.0'), true);
checkEq('isNewer length diff', isNewer('1.0', '1.0.1'), true);
checkEq('isNewer length diff rev', isNewer('1.0.1', '1.0'), false);

// Live probe of the real GitHub API (skips gracefully if network is off).
const latest = await fetchLatestGitHubVersion();
if (latest === null) {
  console.log('SKIP         live GitHub fetch (no network / rate limited)');
} else {
  checkEq('live GitHub tag format', /^\d+(\.\d+)*$/.test(latest), true);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
