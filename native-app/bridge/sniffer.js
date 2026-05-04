const midi = require('easymidi');

// Find the MG-30 port
const inputs = midi.getInputs();
const mg30InputName = inputs.find(name => name.includes('NUX MG-30'));
const mg30OutputName = midi.getOutputs().find(name => name.includes('NUX MG-30'));

if (!mg30InputName) {
  console.error('❌ NUX MG-30 not found in MIDI inputs! Please check your USB connection.');
  process.exit(1);
}

const input = new midi.Input(mg30InputName);
const output = mg30OutputName ? new midi.Output(mg30OutputName) : null;

console.log(`📡 Listening to MG-30 on: ${mg30InputName}`);
console.log('--- ACTION REQUIRED ---');
console.log('1. Turn the patch knob on the pedal.');
console.log('2. Stomp on a couple of buttons (Delay, Reverb).');
console.log('3. Turn one of the effect knobs.');
console.log('-----------------------');

input.on('sysex', (msg) => {
  const hex = msg.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  console.log(`[SYSEX RECEIVED] (${msg.bytes.length} bytes):`);
  console.log(hex);
  console.log('---');
});

input.on('program', (msg) => {
  console.log(`[PC RECEIVED] Patch Number: ${msg.number}`);
});

input.on('controlchange', (msg) => {
  console.log(`[CC RECEIVED] Controller: ${msg.controller}, Value: ${msg.value}`);
});

// Optional: Send an identity request to see if it triggers a response
if (output) {
  console.log('Sending Identity Request...');
  output.send('sysex', [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);
}

// Keep running
process.on('SIGINT', () => {
  console.log('\nStopping sniffer...');
  input.close();
  if (output) output.close();
  process.exit();
});
