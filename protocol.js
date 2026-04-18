export const SYSEX_HEADER = [0xF0, 0x43, 0x58, 0x70];
export const REQ_DUMP = [0xF0, 0x43, 0x58, 0x70, 0x0C, 0x00, 0xF7];

export const CATEGORY_MAP = {
    0: 'WAH', 1: 'CMP', 2: 'EFX', 3: 'AMP', 4: 'EQ', 5: 'GATE', 6: 'MOD', 7: 'DLY', 8: 'RVB', 9: 'IR', 10: 'SR', 11: 'VOL'
};

export const MODEL_NAMES = {
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

export function parseHardwareDump(bytes) {
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

  // --- 3. NAME DECODING (Recalibrated Offset to 166) ---
  const nameBytes = bytes.slice(166, 196); 
  let name = "";
  for (let i = 0; i < nameBytes.length; i += 3) {
      if (nameBytes[i] === 0) break;
      name += String.fromCharCode(nameBytes[i]);
      
      let secondChar = nameBytes[i + 2] / 2;
      if (nameBytes[i + 1] === 1) secondChar += 0x40;
      if (secondChar > 31) name += String.fromCharCode(secondChar);
  }
  
  return {
      name: name.trim().replace(/[^a-zA-Z0-9\s\-]/g, ""),
      chain
  };
}
