const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const midi = require('easymidi');
const cors = require('cors');
const fs = require('fs');
const path = require('path');


const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3001;
const PRESETS_FILE = path.join(__dirname, 'presets.json');

// --- NUX PROTOCOL CONSTANTS ---
const SYSEX_HEADER = [0xF0, 0x43, 0x58, 0x70];
const REQ_DUMP = [0x0C, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // Request Detail Dump (adjusted for active only)
const SYSEX_FOOTER = [0xF7];

const CC_MAP = {
  1: 'WAH', 2: 'CMP', 3: 'EFX', 4: 'AMP', 5: 'EQ', 6: 'GATE', 7: 'MOD', 8: 'DLY', 9: 'RVB', 10: 'S/R'
};

const CATEGORY_MAP = {
    0: 'WAH', 1: 'CMP', 2: 'EFX', 3: 'AMP', 4: 'EQ', 5: 'GATE', 6: 'MOD', 7: 'DLY', 8: 'RVB', 9: 'IR', 10: 'SR', 11: 'VOL'
};

const MODEL_NAMES = {
    'AMP': {
        0: 'Jazz Clean', 1: 'Deluxe Rev', 2: 'Bassmate', 3: 'Tweedy', 4: 'Twin Rev', 5: 'Hiwire', 6: 'Cali Crunch', 
        7: 'Class A15', 8: 'Class A30', 9: 'Plexi 100', 10: 'Plexi 45', 11: 'Brit 800', 12: '1987 X 50', 
        13: 'SLO 100', 14: 'Fireman', 15: 'Dual Rect', 16: 'Die VH4', 17: 'Vibro King', 18: 'Budda', 19: 'Mr. Z 38'
    },
    'EFX': {
        0: 'Rose Comp', 1: 'K Comp', 2: 'Katana', 3: 'RC Boost', 4: 'AC Boost', 5: 'T Scream', 6: 'Blues Drv', 
        7: 'Morning Drv', 8: 'Red Dirt', 9: 'Crunch', 10: 'Muff Fuzz', 11: 'Red Fuzz', 12: 'Dist One'
    },
    'DLY': {
        0: 'Analog Delay', 1: 'Digital Delay', 2: 'Mod Delay', 3: 'Tape Echo', 4: 'Reverse', 5: 'Pan Delay'
    },
    'RVB': {
        0: 'Room', 1: 'Hall', 2: 'Plate', 3: 'Spring', 4: 'Shimmer'
    }
};

let presets = {};

try {
  if (fs.existsSync(PRESETS_FILE)) {
    presets = JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf8'));
  }
} catch (err) {
  console.error('Error loading presets:', err);
}

function savePresets() {
  try {
    fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2));
  } catch (err) {
    console.error('Error saving presets:', err);
  }
}


// State management
let pedalState = {
  patchNumber: 0,
  patchName: 'DEFAULT',
  chain: [],
  scene: 1
};

let lastRawData = '';

// Sync initial patch state from memory
const initialPreset = presets[pedalState.patchNumber] || {};
pedalState.patchName = typeof initialPreset === 'string' ? initialPreset : (initialPreset.name || 'DEFAULT');
if (initialPreset.blocks) {
  pedalState.blocks = { ...pedalState.blocks, ...initialPreset.blocks };
}



// MIDI Setup
let input;
let output;

function requestHardwareState() {
  if (output) {
    // The command to trigger the 222-byte dump
    output.send('sysex', [0xF0, 0x43, 0x58, 0x70, 0x0C, 0x00, 0xF7]);
  }
}

function parseHardwareDump(bytes) {
  // Delta check: Skip parsing if the hardware state hasn't changed
  const hex = bytes.toString();
  if (hex === lastRawData) return;
  lastRawData = hex;

  // --- 1. EXTRACT SIGNAL CHAIN ORDER (Starts at 151) ---
  const orderData = bytes.slice(151, 151 + 18);
  const order = [];
  for (let i = 0; i < orderData.length; ) {
    if (i % 3 === 0) {
      order.push(orderData[i]);
      i++;
    } else {
      const combined = (orderData[i] << 8) | orderData[i+1];
      order.push(Math.floor(combined / 2));
      i += 2;
    }
  }

  // --- 2. TRAVERSE 12 SLOTS (Start at Byte 6, 3 bytes per slot) ---
  const chain = order.map((catId, slotIdx) => {
      const category = CATEGORY_MAP[catId];
      if (!category) return null;

      const slotStart = 6 + (slotIdx * 3);
      const modelByte = bytes[slotStart];
      
      const isBypassed = modelByte >= 64;
      const modelId = isBypassed ? modelByte - 64 : modelByte;
      
      const modelName = MODEL_NAMES[category] ? (MODEL_NAMES[category][modelId] || `${category} ${modelId}`) : category;

      return {
          id: category,
          active: !isBypassed,
          model: modelName
      };
  }).filter(b => b !== null);

  // --- 3. NAME DECODING (Shifted to 166) ---
  const nameBytes = bytes.slice(166, 196); 
  let name = "";
  for (let i = 0; i < nameBytes.length; i += 3) {
      if (nameBytes[i] === 0) break;
      name += String.fromCharCode(nameBytes[i]);
      
      let secondChar = nameBytes[i + 2] / 2;
      if (nameBytes[i + 1] === 1) secondChar += 0x40;
      if (secondChar > 31) name += String.fromCharCode(secondChar);
  }
  
  name = name.trim().replace(/[^a-zA-Z0-9\s\-]/g, "");

  // --- NAME DIAGNOSTIC (remove once decoder is fixed) ---
  // Dumps a widened window around the name region so we can compare raw
  // bytes vs. what the pedal's display shows.
  if (!parseHardwareDump._nameLogged || parseHardwareDump._lastPatch !== pedalState.patchNumber) {
    parseHardwareDump._nameLogged = true;
    parseHardwareDump._lastPatch = pedalState.patchNumber;
    const win = bytes.slice(165, 198);
    const hex = Array.from(win).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(win).map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.').join('');
    const shifted = Array.from(win).map(b => {
      const c = (b >> 1);
      return (c >= 0x20 && c < 0x7f) ? String.fromCharCode(c) : '.';
    }).join('');
    console.log(`🔎 [NAME DEBUG] patch=${pedalState.patchNumber} decoded="${name}"`);
    console.log(`    offsets: 165..197`);
    console.log(`    hex:     ${hex}`);
    console.log(`    ascii:   ${ascii}`);
    console.log(`    shift>>1:${shifted}`);
  }

  console.log(`✅ [DYNAMIC SYNC] ${name} (${chain.filter(b=>b.active).length} active blocks)`);
  
  pedalState.patchName = name || `Patch ${pedalState.patchNumber}`;
  pedalState.chain = chain;
  io.emit('stateUpdate', pedalState);
}

try {
  const inputs = midi.getInputs();
  const outputs = midi.getOutputs();
  const mg30InputName = inputs.find(name => name.includes('NUX MG-30'));
  const mg30OutputName = outputs.find(name => name.includes('NUX MG-30'));
  
  if (mg30InputName) {
    input = new midi.Input(mg30InputName);
    if (mg30OutputName) {
        output = new midi.Output(mg30OutputName);
        console.log(`Connected to: ${mg30InputName} (In/Out)`);
        // Initial Sync
        setTimeout(requestHardwareState, 1000);
    } else {
        console.log(`Connected to: ${mg30InputName} (Read Only)`);
    }
    
    input.on('sysex', (msg) => {
      // Check for the 222-byte dump response
      if (msg.bytes.length > 200 && msg.bytes[1] === 0x43 && msg.bytes[2] === 0x58 && msg.bytes[4] === 0x0C) {
          parseHardwareDump(msg.bytes);
      }
    });

    input.on('program', (msg) => {
      console.log('Patch Changed:', msg.number);
      pedalState.patchNumber = msg.number;
      
      // Request fresh hardware dump on patch change
      requestHardwareState();
    });



    input.on('controlchange', (msg) => {
      console.log('CC Received:', msg.controller, msg.value);
      // Immediate poll on CC
      requestHardwareState();
    });

    // --- HIGH FREQUENCY POLLING ---
    // Poll the hardware every 500ms for silent state changes (footswitches, knobs)
    setInterval(requestHardwareState, 500);


  } else {
    console.warn('MG-30 not found. Running in simulation mode.');
    // Emit dummy data periodically for simulation
    setInterval(() => {
      pedalState.patchNumber = (pedalState.patchNumber + 1) % 100;
      const saved = presets[pedalState.patchNumber] || {};
      pedalState.patchName = typeof saved === 'string' ? saved : (saved.name || 'DEFAULT');
      if (saved.blocks) {
        pedalState.blocks = { ...pedalState.blocks, ...saved.blocks };
      }
      io.emit('stateUpdate', pedalState);
    }, 5000);


  }
} catch (err) {
  console.error('MIDI Error:', err);
}

// Add a diagnostic endpoint
app.get('/status', (req, res) => {
  res.json({ connected: !!input, state: pedalState });
});

io.on('connection', (socket) => {
  console.log('Mobile client connected');
  socket.emit('stateUpdate', pedalState);

  socket.on('requestState', () => {
    socket.emit('stateUpdate', pedalState);
  });

  socket.on('renamePatch', (data) => {
    const { number, name } = data;
    console.log(`Renaming patch ${number} to: ${name}`);
    
    if (!presets[number] || typeof presets[number] === 'string') {
      presets[number] = { name: name, blocks: {} };
    } else {
      presets[number].name = name;
    }
    
    savePresets();
    
    if (pedalState.patchNumber === number) {
      pedalState.patchName = name;
    }
    io.emit('stateUpdate', pedalState);
  });

});


server.listen(PORT, '0.0.0.0', () => {
  console.log(`MIDI Bridge Server running on http://0.0.0.0:${PORT}`);
});
