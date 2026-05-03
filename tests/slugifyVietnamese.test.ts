import { slugifyVietnamese } from "../src/utils/slugifyVietnamese";

const cases: { input: string; expected: string }[] = [
  {
    input: "CÔNG TY CỔ PHẦN ANOVA FEED",
    expected: "cong-ty-co-phan-anova-feed",
  },
  {
    input: "CÔNG TY TNHH SỢI THÉP TINH PHẨM TENG YUAN VIỆT NAM",
    expected: "cong-ty-tnhh-soi-thep-tinh-pham-teng-yuan-viet-nam",
  },
  {
    input: "CÔNG TY TNHH PANASONIC VIỆT NAM",
    expected: "cong-ty-tnhh-panasonic-viet-nam",
  },
  {
    input: "CÔNG TY TNHH BAO BÌ VINH HƯNG VIỆT NAM",
    expected: "cong-ty-tnhh-bao-bi-vinh-hung-viet-nam",
  },
  {
    input: "CÔNG TY CỔ PHẦN TẦM NHÌN MỚI",
    expected: "cong-ty-co-phan-tam-nhin-moi",
  },
  {
    input: "CÔNG TY TNHH DAON TRADING AND LOGISTICS",
    expected: "cong-ty-tnhh-daon-trading-and-logistics",
  },
  {
    input: "CÔNG TY TNHH NEW SITC CONTAINER LINES VIỆT NAM",
    expected: "cong-ty-tnhh-new-sitc-container-lines-viet-nam",
  },
];

let pass = 0;
let fail = 0;
const failures: string[] = [];

for (const c of cases) {
  const got = slugifyVietnamese(c.input);
  if (got === c.expected) {
    pass++;
  } else {
    fail++;
    failures.push(`FAIL: ${c.input}\n  expected: ${c.expected}\n  got:      ${got}`);
  }
}

// eslint-disable-next-line no-console
console.log(`slugifyVietnamese: ${pass} passed, ${fail} failed`);
if (failures.length) {
  // eslint-disable-next-line no-console
  console.error(failures.join("\n"));
  process.exit(1);
}
