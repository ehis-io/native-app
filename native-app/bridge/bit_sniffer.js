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

let firstDump = null;

console.log('📡 [BIT SNIFFER] Initializing...');
console.log('Step 1: Capturing baseline state...');

input.on('sysex', (msg) => {
  if (msg.bytes.length > 200) {
    if (!firstDump) {
      firstDump = Array.from(msg.bytes);
      console.log('✅ Baseline captured!');
      console.log('\n👉 ACTION REQUIRED: On your PHYSICAL PEDAL, please TOGGLE ONE EFFECT (e.g. turn Delay ON or OFF).');
      console.log('Waiting for you to change something...');
    } else {
      console.log('✅ Secondary state captured! Comparing...');
      const secondDump = Array.from(msg.bytes);
      let diffs = [];
      for (let i = 0; i < firstDump.length; i++) {
        if (firstDump[i] !== secondDump[i]) {
          diffs.push({
            index: i,
            old: firstDump[i].toString(16).toUpperCase(),
            new: secondDump[i].toString(16).toUpperCase()
          });
        }
      }

      if (diffs.length === 0) {
        console.log('🤷 No changes detected. Make sure you pressed an effect bypass footswitch.');
      } else {
        console.log('\n🌟 CHANGE DETECTED!');
        diffs.forEach(d => {
           console.log(`Byte [${d.index}]: ${d.old} -> ${d.new}`);
        });
        console.log('\nPlease tell me which effect you toggled (e.g. "I turned Delay ON").');
      }
      process.exit(0);
    }
  }
});

// Request initial dump
output.send('sysex', [0xF0, 0x43, 0x58, 0x70, 0x0C, 0x00, 0xF7]);

// Request second dump after 5 seconds automatically? 
// No, better to wait for user to say something? 
// Actually, I'll set it to request every 1 second until it sees a change.
const poller = setInterval(() => {
    output.send('sysex', [0xF0, 0x43, 0x58, 0x70, 0x0C, 0x00, 0xF7]);
}, 1000);
