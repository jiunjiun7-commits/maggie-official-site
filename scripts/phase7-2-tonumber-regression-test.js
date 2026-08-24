/**
 * Phase 7.2 Step 2｜toNumber() regression tests（純函式，不碰 DB）
 *
 *   node scripts/phase7-2-tonumber-regression-test.js
 */
const { toNumber } = require("./geocoding/plvr-fetch");

const cases = [
  ["", null],
  [" ", null],
  [null, null],
  [undefined, null],
  ["0", 0],
  [0, 0],
  ["275997", 275997],
  ["275,997", 275997],
  ["abc", null]
];

let pass = 0;
let fail = 0;
for (const [input, expected] of cases) {
  const actual = toNumber(input);
  const ok = Object.is(actual, expected);
  console.log(`${ok ? "PASS" : "FAIL"} toNumber(${JSON.stringify(input)}) = ${JSON.stringify(actual)} ${ok ? "" : `(expected ${JSON.stringify(expected)})`}`);
  if (ok) pass++;
  else fail++;
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exitCode = 1;
