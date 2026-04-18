const midi = require('easymidi');

const inputs = midi.getInputs();
const mg30InputName = inputs.find(name => name.includes('NUX MG-30'));

if (!mg30InputName) {
  console.error('❌ MG-30 not found.');
  process.exit(1);
}

const input = new midi.Input(mg30InputName);

console.log(`📡 [TRAFFIC SNIFFER] Listening on ${mg30InputName}...`);
console.log('👉 ACTION REQUIRED: On your PHYSICAL PEDAL, please press ONE footswitch (e.g. toggle Delay).');

input.on('sysex', (msg) => {
    const hex = msg.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    console.log(`[SYSEX] (${msg.bytes.length} bytes): ${hex}`);
});

input.on('controlchange', (msg) => {
    console.log(`[CC] Controller: ${msg.controller}, Value: ${msg.value}`);
});

input.on('program', (msg) => {
    console.log(`[PC] Program: ${msg.number}`);
});

input.on('noteon', (msg) => {
    console.log(`[NOTE ON] Note: ${msg.note}, Velocity: ${msg.velocity}`);
});

process.on('SIGINT', () => {
    console.log('\nStopping sniffer...');
    process.exit();
});
