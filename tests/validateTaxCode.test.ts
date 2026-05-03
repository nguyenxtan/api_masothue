import { validateTaxCode } from "../src/utils/validateTaxCode";

type Case = { input: unknown; expected: boolean; label: string };

const cases: Case[] = [
  { input: "0100104595", expected: true, label: "10 digits (main)" },
  { input: "0100104595-017", expected: true, label: "10 digits + -017 (branch)" },
  { input: "0303449450", expected: true, label: "10 digits (main, alt)" },
  { input: "0303449450-001", expected: true, label: "10 digits + -001 (branch)" },
  { input: "  0100104595-017  ", expected: true, label: "trims whitespace" },

  { input: "010010459", expected: false, label: "9 digits" },
  { input: "01001045950", expected: false, label: "11 digits" },
  { input: "0100104595-17", expected: false, label: "branch suffix only 2 digits" },
  { input: "0100104595-0170", expected: false, label: "branch suffix 4 digits" },
  { input: "0100104595_017", expected: false, label: "underscore separator" },
  { input: "abc0100104595", expected: false, label: "alpha prefix" },
  { input: "", expected: false, label: "empty string" },
  { input: null, expected: false, label: "null" },
  { input: undefined, expected: false, label: "undefined" },
  { input: 1234567890, expected: false, label: "number type" },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const c of cases) {
  const result = validateTaxCode(c.input as string);
  if (result === c.expected) {
    passed++;
  } else {
    failed++;
    failures.push(
      `FAIL: ${c.label} — input=${JSON.stringify(c.input)}, expected=${c.expected}, got=${result}`
    );
  }
}

// eslint-disable-next-line no-console
console.log(`validateTaxCode: ${passed} passed, ${failed} failed`);
if (failures.length) {
  // eslint-disable-next-line no-console
  console.error(failures.join("\n"));
  process.exit(1);
}
