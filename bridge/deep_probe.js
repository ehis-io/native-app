const midi = require('easymidi');

const inputs = midi.getInputs();
const mg30InputName = inputs.find(name => name.includes('NUX MG-30'));
const mg30OutputName = midi.getOutputs().find(name => name.includes('NUX MG-30'));

if (!mg30InputName || !mg30OutputName) {
  console.error('❌ MG-30 MIDI ports not found. Check USB connection.');
  process.exit(1);
}

const input = new midi.Input(mg30InputName);
const output = new midi.Output(mg30OutputName);

const PROBES = [
  // 1. Standard NUX MG-30/300 Request Edit Buffer
  [0xF0, 0x00, 0x01, 0x68, 0x01, 0x02, 0xF7],
  
  // 2. Alternate NUX Request (v1.x firmware)
  [0xF0, 0x00, 0x01, 0x68, 0x01, 0x00, 0x01, 0xF7],
  
  // 3. Cherub/NUX Family Request
  [0xF0, 0x43, 0x58, 0x01, 0x00, 0x01, 0xF7],
  
  // 4. Identity Request (Broadcast)
  [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]
];

console.log(`📡 Probing MG-30 on: ${mg30OutputName}`);

input.on('sysex', (msg) => {
  const hex = msg.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  console.log(`\n✅ RESPONSE RECEIVED (${msg.bytes.length} bytes):`);
  console.log(hex);
  console.log('-------------------------------------------');
});

let probeIdx = 0;
const runProbe = () => {
  if (probeIdx >= PROBES.length) {
    console.log('\n🏁 All probes sent. If no response appeared, the pedal may be in a non-MIDI mode.');
    setTimeout(() => process.exit(), 5000);
    return;
  }

  const bytes = PROBES[probeIdx];
  const hex = bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  console.log(`\n🚀 Sending Probe #${probeIdx + 1}: ${hex}`);
  
  output.send('sysex', bytes);
  probeIdx++;
  setTimeout(runProbe, 2000);
};

runProbe();
