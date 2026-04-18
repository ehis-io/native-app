const midi = require('easymidi');

const inputs = midi.getInputs();
const inName = inputs.find(n => n.includes('NUX MG-30'));
const outName = midi.getOutputs().find(n => n.includes('NUX MG-30'));

if (!inName || !outName) {
  console.error('MG-30 not found');
  process.exit(1);
}

const input = new midi.Input(inName);
const output = new midi.Output(outName);

const HEADER = [0xF0, 0x43, 0x58, 0x70];
const FOOTER = 0xF7;
const KNOWN = 0x0C;

let currentOp = null;
const responses = new Map();

input.on('sysex', (msg) => {
  const bytes = msg.bytes;
  const op = currentOp;
  if (op === null) return;
  const prev = responses.get(op);
  if (!prev) {
    responses.set(op, { count: 1, len: bytes.length, sample: bytes.slice(0, 24) });
  } else {
    prev.count++;
  }
});

const opcodes = [];
for (let i = 0x00; i <= 0x7F; i++) opcodes.push(i);

let idx = 0;
const sendNext = () => {
  if (idx >= opcodes.length) {
    console.log('\n=== SWEEP COMPLETE ===');
    const rows = [...responses.entries()].sort((a, b) => a[0] - b[0]);
    for (const [op, info] of rows) {
      const tag = op === KNOWN ? '  (known dump)' : '';
      const sampleHex = info.sample.map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`op 0x${op.toString(16).padStart(2, '0')}: ${info.len} bytes  sample: ${sampleHex}${tag}`);
    }
    console.log(`\nunique opcodes with responses: ${rows.length}`);
    process.exit(0);
    return;
  }
  currentOp = opcodes[idx++];
  const msg = [...HEADER, currentOp, 0x00, FOOTER];
  output.send('sysex', msg);
  setTimeout(sendNext, 150);
};

console.log(`sweeping opcodes 0x00..0x7F on ${outName}`);
sendNext();
