# MG-30 Companion App

A mobile application for the NUX MG-30 Guitar Multi-Effects Processor.

## 🚀 Features

- **Real-time Patch Monitoring**: View current patch name, number, and signal chain.
- **Dual Connection Modes**:
  - **WIFI**: Connect via a Socket.io server for wireless control.
  - **USB MIDI**: Direct connection to the MG-30 via USB for low-latency control.
- **Visual Signal Chain**: Interactive view of the current effects chain with active/bypass status.
- **Modern UI**: Dark mode interface designed for performance and ease of use.

## 🛠 Technical Stack

- **Framework**: React Native / Expo
- **Icons**: Lucide React Native
- **Communication**: Socket.io (WIFI), Native MIDI API (USB)
- **State Management**: React Hooks

## 📦 Setup & Installation

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   cd native-app
   npm install
   ```
3. **Configure Server IP**:
   Update the `SERVER_IP` constant in `native-app/App.js` to match your laptop's IP address if using WIFI mode.
4. **Run the application**:
   ```bash
   npx expo start
   ```

## 🔌 Connection Modes

### WIFI Mode
Connects to a bridge server (running on a laptop) that communicates with the MG-30 via USB. This allows for wireless control of the unit from across the room.

### USB Mode
Connects the mobile device directly to the MG-30's USB port using an OTG adapter. This provides the most direct and low-latency experience.

---
Built with ❤️ for the MG-30 community.
