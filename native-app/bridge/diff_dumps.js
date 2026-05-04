const fs = require('fs');
const path = require('path');

const [,, a, b] = process.argv;
if (!a || !b) { console.error('usage: diff_dumps.js <labelA> <labelB>'); process.exit(1); }

const dir = path.join(__dirname, 'dumps');
const A = JSON.parse(fs.readFileSync(path.join(dir, `${a}.json`)));
const B = JSON.parse(fs.readFileSync(path.join(dir, `${b}.json`)));

const len = Math.max(A.length, B.length);
const diffs = [];
for (let i = 0; i < len; i++) {
  if (A[i] !== B[i]) diffs.push({ offset: i, a: A[i], b: B[i] });
}

console.log(`diffs between ${a} (${A.length}b) and ${b} (${B.length}b): ${diffs.length} bytes changed`);
for (const d of diffs) {
  const da = (d.a ?? 0);
  const db = (d.b ?? 0);
  console.log(`  [${String(d.offset).padStart(3)}] 0x${da.toString(16).padStart(2,'0')} -> 0x${db.toString(16).padStart(2,'0')}  (${da} -> ${db}, delta ${db - da})`);
}
