import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Independent finite-domain checks; this script never calls or imitates PICT.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const transferDomains = {
  From: ['Valid', 'Frozen', 'Missing'],
  To: ['Valid', 'Missing', 'SameAsFrom'],
  Amount: ['Normal', 'Zero', 'Negative', 'OverBalance', 'OverLimit', 'ExactLimit'],
  Currency: ['Same', 'Different'],
  DailyUsage: ['Fresh', 'Used'],
};
const browserDomains = {
  Content: ['Allow', 'Restrict', 'Block'],
  Cookies: ['Allow', 'Restrict', 'Block'],
  Popups: ['Yes', 'No'],
  Addons: ['Yes', 'No'],
  Attacks: ['Yes', 'No'],
  Forgeries: ['Yes', 'No'],
};
const negativeChoices = {
  From: ['Frozen', 'Missing'],
  To: ['Missing', 'SameAsFrom'],
  Amount: ['Zero', 'Negative', 'OverBalance', 'OverLimit'],
};
const normalize = value => value.replace(/^~/, '');
const choiceErrors = row => Object.entries(negativeChoices)
  .reduce((sum, [key, choices]) => sum + Number(choices.includes(row[key])), 0);

function cartesian(domains) {
  return Object.entries(domains).reduce((rows, [key, values]) =>
    rows.flatMap(row => values.map(value => ({ ...row, [key]: value }))), [{}]);
}

function allowed(row) {
  if (row.To === 'SameAsFrom' && row.From === 'Missing') return false;
  if (row.Amount === 'OverBalance' && row.DailyUsage !== 'Fresh') return false;
  if (row.Amount === 'OverLimit' && row.DailyUsage !== 'Used') return false;
  if (row.Amount === 'ExactLimit') {
    return row.From === 'Valid' && row.To === 'Valid'
      && row.Currency === 'Same' && row.DailyUsage === 'Used';
  }
  return true;
}

function checkModel(filename, domains, negative = false) {
  const lines = readFileSync(resolve(root, filename), 'utf8')
    .replace(/^\uFEFF/, '').split(/\r?\n/);
  const parsed = {};
  for (const line of lines) {
    const match = /^([A-Za-z]+):\s*(.+)$/.exec(line.trim());
    if (!match) continue;
    const [, parameter, choices] = match;
    assert.ok(!(parameter in parsed), `${filename}: duplicate parameter`);
    parsed[parameter] = choices.split(',').map(value => value.trim());
  }
  assert.deepEqual(Object.keys(parsed), Object.keys(domains), `${filename}: parameters`);
  for (const [key, values] of Object.entries(domains)) {
    assert.deepEqual(parsed[key].map(normalize), values, `${filename}: ${key} levels`);
    for (const raw of parsed[key]) {
      const expectedNegative = negative && (negativeChoices[key] ?? []).includes(normalize(raw));
      assert.equal(raw.startsWith('~'), expectedNegative, `${filename}: negative marker ${raw}`);
    }
  }
}

function readRows(filename, domains, negative = false) {
  const lines = readFileSync(resolve(root, 'results', filename), 'utf8')
    .replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
  const header = lines.shift().split('\t');
  assert.deepEqual(header, Object.keys(domains), `${filename}: TSV header`);
  const rows = lines.map((line, index) => {
    assert.ok(line.length, `${filename}: blank data row ${index + 1}`);
    const cells = line.split('\t');
    assert.equal(cells.length, header.length, `${filename}: column count`);
    const row = Object.fromEntries(header.map((key, i) => [key, normalize(cells[i])]));
    header.forEach((key, i) => {
      assert.ok(domains[key].includes(row[key]), `${filename}: unknown ${key} value`);
      const expectedNegative = negative && (negativeChoices[key] ?? []).includes(row[key]);
      assert.equal(cells[i].startsWith('~'), expectedNegative, `${filename}: marker at row ${index + 1}`);
    });
    return row;
  });
  assert.equal(new Set(rows.map(row => JSON.stringify(row))).size, rows.length,
    `${filename}: duplicate normalized rows`);
  return rows;
}

function indexSubsets(size, order, start = 0, prefix = []) {
  if (prefix.length === order) return [prefix];
  const answer = [];
  for (let i = start; i < size; i++) answer.push(...indexSubsets(size, order, i + 1, [...prefix, i]));
  return answer;
}

function tuples(rows, keys, order) {
  const subsets = indexSubsets(keys.length, order);
  const output = new Set();
  for (const row of rows) for (const indexes of subsets) {
    output.add(JSON.stringify(indexes.map(i => [keys[i], row[keys[i]]])));
  }
  return output;
}

function checkCoverage(filename, rows, space, domains, order) {
  const keys = Object.keys(domains);
  const expected = tuples(space, keys, order);
  const actual = tuples(rows, keys, order);
  const missing = [...expected].filter(tuple => !actual.has(tuple));
  const extra = [...actual].filter(tuple => !expected.has(tuple));
  assert.equal(missing.length, 0, `${filename}: missing ${order}-way tuples: ${missing.slice(0, 5)}`);
  assert.equal(extra.length, 0, `${filename}: inadmissible tuples: ${extra.slice(0, 5)}`);
  return expected.size;
}

function oracle(row) {
  const used = row.DailyUsage === 'Fresh' ? 0 : 1500;
  const remaining = 2000 - used;
  const debit = {
    Normal: 100, Zero: 0, Negative: -1, OverBalance: 1001,
    OverLimit: remaining + 1, ExactLimit: remaining,
  }[row.Amount];
  const from = { Valid: 'A100', Frozen: 'F100', Missing: 'X404' }[row.From];
  const to = row.To === 'SameAsFrom' ? from : row.To === 'Missing' ? 'Y404' : 'A200';
  const body = { from, to, amount: row.Currency === 'Same' ? debit : debit / 2,
    currency: row.Currency === 'Same' ? 'MNT' : 'USD' };
  const faults = [];
  if (row.From === 'Missing') faults.push('ERROR_NO_FROM');
  if (row.From === 'Frozen') faults.push('ERROR_FROZEN');
  if (row.To === 'Missing' || (row.To === 'SameAsFrom' && row.From === 'Missing')) faults.push('ERROR_NO_TO');
  if (row.To === 'SameAsFrom') faults.push('ERROR_SAME_ACCOUNT');
  if (debit <= 0) faults.push('ERROR_BAD_AMOUNT');
  // A missing account has no real balance or daily usage to compare against.
  // Its money comparisons are undefined; earlier NO_FROM still determines the oracle.
  const financialChecksDefined = row.From !== 'Missing';
  if (financialChecksDefined && debit > 1000) faults.push('ERROR_INSUFFICIENT');
  if (financialChecksDefined && debit > remaining) faults.push('ERROR_LIMIT');
  return {
    body, debit, used, remaining, financialChecksDefined, faults,
    status: faults.length ? 200 : 201, result: faults[0] ?? 'OK',
  };
}

function histogram(values) {
  return JSON.stringify(values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {}));
}

const allTransfers = cartesian(transferDomains);
const constrained = allTransfers.filter(allowed);
const isolated = constrained.filter(row => choiceErrors(row) <= 1);
assert.equal(allTransfers.length, 216);
assert.equal(constrained.length, 129);
assert.equal(isolated.length, 33);
assert.equal(isolated.filter(row => oracle(row).result === 'OK').length, 5);
assert.ok(isolated.every(row => oracle(row).faults.length <= 1));

const report = [
  'Independent finite-domain verification: PASS',
  'Command: node scripts/verify.mjs',
  'No PICT run, random seed, external dependency, or transfer implementation is used by this checker.',
  'Enumerated transfer frames: full=216; IF/SINGLE=129; IF/SINGLE plus <=1 ERROR choice=33.',
  'The 33 isolated frames comprise 5 happy frames and 28 single-error frames.',
  'Generated-row numbers below are 1-based DATA rows (header excluded).',
  '',
];

checkModel('browser.model', browserDomains);
const browserSpace = cartesian(browserDomains);
assert.equal(browserSpace.length, 144);
for (const [filename, order] of [['browser-2way.txt', 2], ['browser-3way.txt', 3]]) {
  const rows = readRows(filename, browserDomains);
  const covered = checkCoverage(filename, rows, browserSpace, browserDomains, order);
  report.push(`${filename}: rows=${rows.length}; ${order}-way coverage=${covered}/${covered}; duplicates=0.`);
}
report.push('');

const generated = {};
for (const [stem, space, negative] of [
  ['transfer-nc', allTransfers, false],
  ['transfer', constrained, false],
  ['transfer-neg', isolated, true],
]) {
  const filename = `${stem}.txt`;
  checkModel(`${stem}.model`, transferDomains, negative);
  const rows = readRows(filename, transferDomains, negative);
  const allowedRows = new Set(space.map(row => JSON.stringify(row)));
  rows.forEach((row, i) => assert.ok(allowedRows.has(JSON.stringify(row)), `${filename}: invalid frame ${i + 1}`));
  const covered = checkCoverage(filename, rows, space, transferDomains, 2);
  const evaluated = rows.map(oracle);
  const exact = rows.filter(row => row.Amount === 'ExactLimit').length;
  if (stem !== 'transfer-nc') assert.equal(exact, 1, `${filename}: ExactLimit SINGLE`);
  if (negative) assert.ok(rows.every(row => choiceErrors(row) <= 1 && oracle(row).faults.length <= 1));
  const missingSources = evaluated.filter(test => !test.financialChecksDefined).length;
  const fullyDefined = evaluated.filter(test => test.financialChecksDefined);
  const overlaps = evaluated.flatMap((test, index) =>
    test.faults.includes('ERROR_INSUFFICIENT') && test.faults.includes('ERROR_LIMIT') ? [index + 1] : []);
  report.push(`${filename}: rows=${rows.length}; pair coverage=${covered}/${covered}; happy=${evaluated.filter(test => test.result === 'OK').length}; duplicates=0; ExactLimit rows=${exact}.`);
  report.push(`  Selected ERROR-choice count histogram (count:rows): ${histogram(rows.map(choiceErrors))}`);
  report.push(`  Known violated-predicate count histogram: ${histogram(evaluated.map(test => test.faults.length))}`);
  report.push(`  Existing-source full predicate-count histogram: ${histogram(fullyDefined.map(test => test.faults.length))}`);
  report.push(`  Missing-source rows with undefined financial checks: ${missingSources}; known balance+limit overlaps at data rows: ${JSON.stringify(overlaps)}.`);
  report.push(`  Oracle distribution: ${histogram(evaluated.map(test => test.result))}`);
  generated[stem] = { rows, evaluated };
}

report.push('',
  'Semantic caveat: ERROR-choice counts are selected category labels, not the number of API responses.',
  'Known predicates are fixture conditions, including conditions masked by the chosen validation order.',
  'For From=Missing, balance/limit predicates are undefined and omitted from known-predicate counts.',
  'Therefore those counts are not a complete semantic fault count for missing-source rows.',
  'Negative pair coverage excludes pairs containing two negative choices and all IF/SINGLE-infeasible pairs.',
  '', 'Concrete cases from actual PICT data rows:');

for (const [stem, dataRow] of [
  ['transfer-neg', 2], ['transfer-neg', 6], ['transfer', 2],
  ['transfer-neg', 20], ['transfer', 11], ['transfer-nc', 1], ['transfer-nc', 5],
]) {
  const { rows, evaluated } = generated[stem];
  assert.ok(rows[dataRow - 1], `Concrete case ${stem} data row ${dataRow} missing`);
  report.push(`${stem}.txt data#${dataRow}: ${JSON.stringify(rows[dataRow - 1])}`);
  report.push(`  ${JSON.stringify(evaluated[dataRow - 1])}`);
}

report.push('', 'All checks passed. This validates design artifacts and coverage, not a running bank API.');
const output = `${report.join('\n')}\n`;
writeFileSync(resolve(root, 'results', 'verification.txt'), output, 'utf8');
process.stdout.write(output);
