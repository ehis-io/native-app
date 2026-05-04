const midi = require('easymidi');

const inputs = midi.getInputs();
const mg30InputName = inputs.find(name => name.includes('NUX MG-30'));
const mg30OutputName = midi.getOutputs().find(name => name.includes('NUX MG-30'));

if (!mg30InputName || !mg30OutputName) {
  console.error('❌ MG-30 MIDI ports not found.');
  process.exit(1);
}

const input = new midi.Input(mg30InputName);
const output = new midi.Output(mg30OutputName);

const PROBES = [
  // 1. Request Current Preset Basic (from nuxOnline)
  [0xF0, 0x43, 0x58, 0x70, 0x15, 0x00, 0xF7],
  
  // 2. Request Current Preset Detail (Potential Dump)
  [0xF0, 0x43, 0x58, 0x70, 0x0B, 0x00, 0xF7],
  
  // 3. Request Updated Effect Order
  [0xF0, 0x43, 0x58, 0x70, 0x0C, 0x00, 0xF7],
  
  // 4. Device Version Request
  [0xF0, 0x43, 0x58, 0x00, 0xF7],

  // 5. Alternate NUX Family request
  [0xF0, 0x00, 0x01, 0x68, 0x01, 0x03, 0x00, 0x00, 0xF7]
];

console.log(`📡 Probing MG-30 with targeted commands...`);

input.on('sysex', (msg) => {
  const hex = msg.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  console.log(`\n✅ RESPONSE RECEIVED (${msg.bytes.length} bytes):`);
  console.log(hex);
  
  if (msg.bytes.length > 30) {
    console.log('🌟 SUCCESS! THIS IS A DATA DUMP.');
  }
  console.log('-------------------------------------------');
});

let probeIdx = 0;
const runProbe = () => {
  if (probeIdx >= PROBES.length) {
    console.log('\n🏁 Probing complete.');
    setTimeout(() => process.exit(), 5000);
    return;
  }

  const bytes = PROBES[probeIdx];
  console.log(`🚀 Sending Targeted Probe #${probeIdx + 1}`);
  output.send('sysex', bytes);
  probeIdx++;
  setTimeout(runProbe, 2000);
};

runProbe();
