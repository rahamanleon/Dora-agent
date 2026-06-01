const stringToParts = require('/root/.picoclaw/workspace/Dora-Ai-API/node_modules/mpath/lib/stringToParts');

const tests = [
  { input: 'list[0].name', expected: ['list', '0', 'name'] },
  { input: 'list[0][1].name', expected: ['list', '0', '1', 'name'] },
  { input: 'a.b.c', expected: ['a', 'b', 'c'] },
  { input: 'a..b.d', expected: ['a', '', 'b', 'd'] },
  { input: 'foo[1mystring]', expected: ['foo[1mystring]'] },
  { input: 'foo[1mystring].bar[1]', expected: ['foo[1mystring]', 'bar', '1'] },
  { input: 'foo[1mystring][2]', expected: ['foo[1mystring]', '2'] },
  { input: '', expected: [''] },
  { input: 'a.b.', expected: ['a', 'b', ''] },
];

let allPass = true;
for (const t of tests) {
  const result = stringToParts(t.input);
  const pass = JSON.stringify(result) === JSON.stringify(t.expected);
  if (!pass) {
    console.log(`❌ stringToParts("${t.input}")`);
    console.log(`   Expected: ${JSON.stringify(t.expected)}`);
    console.log(`   Got:      ${JSON.stringify(result)}`);
    allPass = false;
  } else {
    console.log(`✅ ${t.input} => ${JSON.stringify(result)}`);
  }
}

console.log(allPass ? '\n🎉 All tests pass!' : '\n❌ Some tests failed');
