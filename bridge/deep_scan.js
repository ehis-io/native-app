const midi = require('easymidi');

const inputs = midi.getInputs();
const mg30InputName = inputs.find(name => name.includes('NUX MG-30'));
const mg30OutputName = midi.getOutputs().find(name => name.includes('NUX MG-30'));

if (!mg30InputName || !mg30OutputName) {
  console.error('❌ MG-30 not found.');
  process.exit(1);
}

const input = new midi.Input(mg30InputName);
const output = new midi.Output(mg30OutputName);

console.log('📡 [DEEP SCAN] Requesting hardware dump...');

input.on('sysex', (msg) => {
  if (msg.bytes.length > 200) {
    console.log('\n--- RAW HARDWARE DUMP (222 BYTES) ---');
    let row = "";
    for (let i = 0; i < msg.bytes.length; i++) {
        const hex = msg.bytes[i].toString(16).padStart(2, '0').toUpperCase();
        row += `[${i}]${hex} `;
        if ((i + 1) % 8 === 0) {
            console.log(row);
            row = "";
        }
    }
    if (row) console.log(row);
    console.log('\n--- END OF DUMP ---');
    process.exit(0);
  }
});

// Request dump
output.send('sysex', [0xF0, 0x43, 0x58, 0x70, 0x0C, 0x00, 0xF7]);
