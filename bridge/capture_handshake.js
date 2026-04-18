const midi = require('easymidi');

// Find the MG-30 port
const inputs = midi.getInputs();
const mg30InputName = inputs.find(name => name.includes('NUX MG-30'));

if (!mg30InputName) {
  console.error('❌ NUX MG-30 not found! Please check your USB connection.');
  process.exit(1);
}

// We will try to open the input and output to "listen"
const input = new midi.Input(mg30InputName);

console.log(`🕵️ Sniffer active on: ${mg30InputName}`);
console.log('--- ACTION ---');
console.log('Now OPEN the QuickTone software on your computer.');
console.log('Wait 5 seconds for it to sync, then CLOSE it.');
console.log('--------------');

input.on('sysex', (msg) => {
  const hex = msg.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  console.log(`\n📦 CAPTURED SYSEX (${msg.bytes.length} bytes):`);
  console.log(hex);
  
  // Try to identify if this is a "Handshake" or "Data Dump"
  if (msg.bytes.length > 50) {
    console.log('💡 This looks like a FULL DATA DUMP! (Patch Settings)');
  } else if (msg.bytes[3] === 0x68 || msg.bytes[3] === 0x58) {
    console.log('💡 This is an official NUX command.');
  }
});

input.on('program', (msg) => {
  console.log(`[PC] Patch Number: ${msg.number}`);
});

process.on('SIGINT', () => {
  console.log('\nStopping capture...');
  input.close();
  process.exit();
});
