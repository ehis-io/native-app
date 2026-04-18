const midi = require('easymidi');
const fs = require('fs');
const path = require('path');

const label = process.argv[2] || 'dump';
const outDir = path.join(__dirname, 'dumps');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const inputs = midi.getInputs();
const inName = inputs.find(n => n.includes('NUX MG-30'));
const outName = midi.getOutputs().find(n => n.includes('NUX MG-30'));
if (!inName || !outName) { console.error('MG-30 not found'); process.exit(1); }

const input = new midi.Input(inName);
const output = new midi.Output(outName);

input.on('sysex', (msg) => {
  const bytes = msg.bytes;
  if (bytes[4] !== 0x0C || bytes.length < 200) return;
  const fname = path.join(outDir, `${label}.json`);
  fs.writeFileSync(fname, JSON.stringify(Array.from(bytes)));
  console.log(`saved ${bytes.length} bytes -> ${fname}`);
  process.exit(0);
});

output.send('sysex', [0xF0, 0x43, 0x58, 0x70, 0x0C, 0x00, 0xF7]);
setTimeout(() => { console.error('timeout waiting for dump'); process.exit(1); }, 3000);
