import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { io } from 'socket.io-client';
import {
  Zap,
  Activity,
  Layers,
  Settings,
  Edit2,
  Link,
  Usb,
} from 'lucide-react-native';
import * as SplashScreen from 'expo-splash-screen';
import { requestMIDIAccess } from '@motiz88/react-native-midi';
import {
  CATEGORY_MAP,
  MODEL_NAMES,
  REQ_DUMP,
  parseHardwareDump,
} from './protocol';

console.log('🚀 [BUNDLE] App starting up...');

// Prevent splash screen from hiding automatically
SplashScreen.preventAutoHideAsync().catch(() => {});

const { width } = Dimensions.get('window');

// LAPTOP IP - Change this if your laptop IP changes
const SERVER_IP = '192.168.100.24';
const socket = io(`http://${SERVER_IP}:3001`);

const BLOCK_COLORS = {
  WAH: '#ff8800',
  CMP: '#00ccff',
  GATE: '#888888',
  EFX: '#00ff88',
  AMP: '#ffb700',
  IR: '#ff5500',
  EQ: '#aaaaaa',
  SR: '#666666',
  MOD: '#0088ff',
  DLY: '#aa00ff',
  RVB: '#ff3e3e',
  VOL: '#ffffff',
};

export default function App() {
  const [state, setState] = useState({
    patchNumber: 0,
    patchName: 'CONNECTING...',
    blocks: {},
    chain: [],
    scene: 1,
  });
  const [status, setStatus] = useState('offline');
  const [mode, setMode] = useState('wifi'); // 'wifi' or 'usb'
  const [activeMidiAccess, setActiveMidiAccess] = useState(null);
  const [debugInfo, setDebugInfo] = useState({
    inputs: [],
    outputs: [],
    error: null,
  });

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // --- WIFI (SOCKET.IO) LOGIC ---
  useEffect(() => {
    if (mode !== 'wifi') return;

    socket.on('connect', () => {
      setStatus('online (wifi)');
      socket.emit('requestState');
    });

    socket.on('disconnect', () => setStatus('offline'));

    socket.on('stateUpdate', (newState) => {
      setState(newState);
      SplashScreen.hideAsync().catch(() => {});
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('stateUpdate');
    };
  }, [mode]);

  // --- DIRECT USB (NATIVE MIDI) LOGIC ---
  useEffect(() => {
    if (mode !== 'usb') return;

    let pollInterval;
    let midiAccess;

    const findMg30 = async () => {
      try {
        console.log('🔍 [USB] Requesting MIDI Access...');
        setDebugInfo((d) => ({ ...d, error: 'requesting midi access...' }));
        midiAccess = await requestMIDIAccess({ sysex: true });
        setActiveMidiAccess(midiAccess);

        const setupConnection = () => {
          const inputs = Array.from(midiAccess.inputs.values());
          const outputs = Array.from(midiAccess.outputs.values());

          setDebugInfo({
            inputs: inputs.map((i) => i.name || '(no-name)'),
            outputs: outputs.map((o) => o.name || '(no-name)'),
            error: null,
          });

          const matches = (n) => {
            if (!n) return false;
            const s = n.toLowerCase();
            return (
              s.includes('mg-30') ||
              s.includes('mg30') ||
              s.includes('nux') ||
              s.includes('katana')
            );
          };
          const input =
            inputs.find((i) => matches(i.name)) ||
            (inputs.length === 1 ? inputs[0] : null);
          const output =
            outputs.find((o) => matches(o.name)) ||
            (outputs.length === 1 ? outputs[0] : null);

          if (input && output) {
            console.log('⚡ [USB] MG-30 Found!');
            setStatus('online (usb)');

            // Handle incoming MIDI
            input.onmidimessage = (event) => {
              const data = event.data;
              if (data.length > 200 && data[4] === 0x0c) {
                const { name, chain } = parseHardwareDump(data);
                setState((s) => ({ ...s, patchName: name, chain }));
                SplashScreen.hideAsync().catch(() => {});
              }
            };

            // Request initial state
            output.send(REQ_DUMP);

            // High Frequency Sync
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = setInterval(() => {
              output.send(REQ_DUMP);
            }, 500);
          } else {
            setStatus('searching usb...');
          }
        };

        setupConnection();
        midiAccess.onstatechange = setupConnection;
      } catch (err) {
        console.error('USB MIDI Error:', err);
        setStatus('usb error');
        setDebugInfo((d) => ({
          ...d,
          error: String((err && err.message) || err),
        }));
      }
    };

    findMg30();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (midiAccess) {
        midiAccess.onstatechange = null;
      }
    };
  }, [mode]);

  const handleRename = () => {
    if (mode === 'wifi') {
      alert('Renaming is only available in WIFI mode for now.');
    } else {
      alert('Direct USB renaming coming soon!');
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'wifi' ? 'usb' : 'wifi'));
    setStatus('switching...');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.patchIdContainer}>
          <Text style={styles.patchIdText}>
            {state.patchNumber.toString().padStart(2, '0')}
            <Text style={{ fontSize: 20 }}>A</Text>
          </Text>
        </View>
        <View style={styles.patchInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.patchNameText}>{state.patchName}</Text>
            <TouchableOpacity onPress={handleRename} style={styles.editButton}>
              <Edit2 size={16} color="#666" />
            </TouchableOpacity>
          </View>
          <View style={styles.sceneTag}>
            <Text style={styles.sceneText}>SCENE {state.scene}</Text>
          </View>
        </View>
      </View>

      {/* Signal Chain */}
      <View style={styles.chainContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {state.chain &&
            state.chain.map((block, idx) => (
              <React.Fragment key={`${block.id}-${idx}`}>
                <View
                  style={[
                    styles.block,
                    { borderColor: BLOCK_COLORS[block.id] || '#fff' },
                    block.active === false && styles.bypass,
                  ]}
                >
                  <Text
                    style={[
                      styles.blockLabel,
                      { color: BLOCK_COLORS[block.id] || '#fff' },
                    ]}
                  >
                    {block.id}
                  </Text>
                  <Text style={styles.modelLabel} numberOfLines={1}>
                    {block.model}
                  </Text>
                  {block.active !== false && (
                    <View
                      style={[
                        styles.activeGlow,
                        { backgroundColor: BLOCK_COLORS[block.id] || '#fff' },
                      ]}
                    />
                  )}
                </View>
                {idx < state.chain.length - 1 && (
                  <View style={styles.connector} />
                )}
              </React.Fragment>
            ))}
          {(!state.chain || state.chain.length === 0) && (
            <Text style={{ color: '#444' }}>Loading Signal Chain...</Text>
          )}
        </ScrollView>
      </View>

      {/* USB MIDI Debug Panel */}
      {mode === 'usb' && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>USB MIDI DEVICES</Text>
          <Text style={styles.debugLine}>
            IN:{' '}
            {debugInfo.inputs.length ? debugInfo.inputs.join(', ') : '(none)'}
          </Text>
          <Text style={styles.debugLine}>
            OUT:{' '}
            {debugInfo.outputs.length ? debugInfo.outputs.join(', ') : '(none)'}
          </Text>
          {debugInfo.error && (
            <Text style={styles.debugError}>ERR: {debugInfo.error}</Text>
          )}
        </View>
      )}

      {/* Footer / Controls */}

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <TouchableOpacity onPress={toggleMode} style={styles.modeToggle}>
          {mode === 'wifi' ? (
            <Link size={14} color="#0088ff" />
          ) : (
            <Usb size={14} color="#00ff88" />
          )}
          <Text
            style={[
              styles.modeText,
              { color: mode === 'wifi' ? '#0088ff' : '#00ff88' },
            ]}
          >
            {mode.toUpperCase()}
          </Text>
        </TouchableOpacity>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: status.includes('online')
                  ? '#00ff88'
                  : '#ff3e3e',
              },
            ]}
          />
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingBottom: 20,
  },
  patchIdText: {
    fontSize: 70,
    fontWeight: '700',
    color: '#ffb700',
    fontFamily: 'Inter', // Note: Android might need manual font loading for Inter
  },
  patchInfo: {
    alignItems: 'flex-end',
  },
  patchNameText: {
    fontSize: 22,
    color: '#fff',
    letterSpacing: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  editButton: {
    marginLeft: 10,
    padding: 5,
  },

  sceneTag: {
    backgroundColor: 'rgba(0, 136, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  sceneText: {
    color: '#0088ff',
    fontSize: 12,
    fontWeight: '600',
  },
  chainContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  block: {
    width: 70,
    height: 60,
    backgroundColor: '#16161a',
    borderWidth: 1.5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible', // Allow glow to spill out
    marginHorizontal: 5,
  },
  bypass: {
    opacity: 0.25,
    borderColor: '#333 !important', // Force dark border when bypassed
    backgroundColor: '#0a0a0c',
  },

  blockLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 2,
  },
  modelLabel: {
    fontSize: 8,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  activeGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 12,
    opacity: 0.15,
    zIndex: -1,
  },

  connector: {
    width: 15,
    height: 2,
    backgroundColor: '#444',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 30,
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  knobContainer: {
    alignItems: 'center',
  },
  knob: {
    width: 35,
    height: 35,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#333',
    backgroundColor: '#1a1a1e',
    marginBottom: 5,
  },
  knobLabel: {
    fontSize: 8,
    color: '#666',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  modeText: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#666',
    fontSize: 10,
    fontWeight: '700',
  },
  debugPanel: {
    backgroundColor: '#0f0f12',
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  debugTitle: {
    color: '#00ff88',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
  },
  debugLine: {
    color: '#aaa',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  debugError: {
    color: '#ff3e3e',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 4,
  },
});
