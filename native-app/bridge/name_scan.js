const midi = require('easymidi');

const inputs = midi.getInputs();
const mg30InputName = inputs.find(name => name.includes('NUX MG-30'));
const mg30OutputName = midi.getOutputs().find(name => name.includes('NUX MG-30'));

if (!mg30InputName || !mg30OutputName) {
  process.exit(1);
}

const input = new midi.Input(mg30InputName);
const output = new midi.Output(mg30OutputName);

input.on('sysex', (msg) => {
  if (msg.bytes.length > 200) {
    console.log('--- DUMP RECEIVED (Offset Scan) ---');
    // Scan bytes 140 to 200 for ASCII characters
    for (let i = 140; i < 210; i++) {
        const char = String.fromCharCode(msg.bytes[i]);
        const hex = msg.bytes[i].toString(16).padStart(2, '0').toUpperCase();
        console.log(`[${i}] ${hex} -> ${msg.bytes[i] > 31 && msg.bytes[i] < 127 ? char : '.'}`);
    }
    process.exit(0);
  }
});

console.log('Requesting dump for name offset scan...');
output.send('sysex', [0xF0, 0x43, 0x58, 0x70, 0x0C, 0x00, 0xF7]);
