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

console.log('📡 [CALIBRATOR] Searching for "A" (0x41) associated with "ABCDEF"...');

input.on('sysex', (msg) => {
  if (msg.bytes.length > 200) {
    const bytes = Array.from(msg.bytes);
    const indices = [];
    for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0x41) indices.push(i);
    }
    
    if (indices.length > 0) {
        console.log(`\n🌟 Found 'A' (0x41) at potential indices: ${indices.join(', ')}`);
        indices.forEach(idx => {
            const chunk = bytes.slice(Math.max(0, idx - 4), Math.min(bytes.length, idx + 12));
            console.log(`Index [${idx}] Context: ${chunk.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}`);
        });
        console.log('\nMatch Found! Stopping discovery...');
        process.exit(0);
    }
  }
});


// Periodic polling until we find the name
const poller = setInterval(() => {
    output.send('sysex', [0xF0, 0x43, 0x58, 0x70, 0x0C, 0x00, 0xF7]);
}, 1000);
