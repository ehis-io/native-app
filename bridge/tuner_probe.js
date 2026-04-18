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

const CANDIDATES = [0x53, 0x6a, 0x6b, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x7c, 0x7d];
const samples = new Map(); // op -> array of hex strings

input.on('sysex', (msg) => {
  const bytes = msg.bytes;
  const op = bytes[4];
  if (!CANDIDATES.includes(op)) return;
  const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
  if (!samples.has(op)) samples.set(op, []);
  samples.get(op).push(hex);
});

let round = 0;
const ROUNDS = 20; // ~ 2 seconds at 100ms cadence
const pollAll = () => {
  if (round >= ROUNDS) {
    console.log('\n=== RESULTS (op -> distinct payloads observed) ===');
    for (const op of CANDIDATES) {
      const rows = samples.get(op) || [];
      const unique = [...new Set(rows)];
      const tag = unique.length > 1 ? '  *** CHANGES ***' : '';
      console.log(`\nop 0x${op.toString(16)}: ${rows.length} samples, ${unique.length} unique${tag}`);
      unique.slice(0, 3).forEach((h, i) => console.log(`  [${i}] ${h}`));
    }
    process.exit(0);
    return;
  }
  round++;
  CANDIDATES.forEach((op, i) => {
    setTimeout(() => {
      output.send('sysex', [0xF0, 0x43, 0x58, 0x70, op, 0x00, 0xF7]);
    }, i * 8);
  });
  setTimeout(pollAll, 100);
};

console.log('polling for ~2s — hold the low E string on the guitar NOW');
setTimeout(pollAll, 200);
