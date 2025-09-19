# 🎙️ expo-streamer

[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![npm version](https://badge.fury.io/js/expo-streamer.svg)](https://badge.fury.io/js/expo-streamer)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/truemagic-coder/expo-streamer/ci.yml?branch=main)](https://github.com/truemagic-coder/expo-streamer/actions/workflows/ci.yml)
[![codecov](https://img.shields.io/codecov/c/github/truemagic-coder/expo-streamer/main.svg)](https://codecov.io/gh/truemagic-coder/solana-agent)

**Enterprise-grade audio streaming and recording for Expo applications**

> **Zero-crash reliability** • **Full TypeScript support** • **SOLID architecture** • **Production ready**

## ✨ Why Choose expo-streamer?

| Feature | Description |
|---------|-------------|
| 📘 **TypeScript First** | Full TypeScript support with comprehensive type definitions |
| ⚡ **Thread Safe** | Proper synchronization for multi-threaded audio operations |
| 🏗️ **SOLID Architecture** | Clean, maintainable code following industry best practices |
| 🧪 **Fully Tested** | 95%+ test coverage with comprehensive test suites |
| 📱 **Cross Platform** | Works seamlessly on iOS and Android |
| 🎛️ **Real-time** | Low-latency audio streaming perfect for voice apps |

## 🚀 Installation

```bash
npm install expo-streamer
# or
yarn add expo-streamer
```

## 📘 TypeScript Usage

### Basic Recording and Playback

```typescript
import { ExpoStreamer, RecordingConfig, AudioDataEvent } from 'expo-streamer';

// Define recording configuration with full TypeScript support
const recordingConfig: RecordingConfig = {
  sampleRate: 44100,
  channels: 1,
  encoding: 'pcm_16bit',
  interval: 250,
  onAudioStream: (event: AudioDataEvent) => {
    console.log('Audio data received:', {
      data: event.data,
      position: event.position,
      soundLevel: event.soundLevel
    });
  }
};

// Start recording with type safety
const { recordingResult, subscription } = await ExpoStreamer.startRecording(recordingConfig);

// Play audio with proper typing
await ExpoStreamer.playAudio(base64AudioData, 'turn-1', 'pcm_s16le');

// Stop recording
const recording = await ExpoStreamer.stopRecording();
```

### Advanced Configuration with Types

```typescript
import { 
  ExpoStreamer, 
  SoundConfig, 
  PlaybackMode, 
  SampleRate,
  EncodingTypes 
} from 'expo-streamer';

// Configure audio playback with type safety
const soundConfig: SoundConfig = {
  sampleRate: 44100 as SampleRate,
  playbackMode: 'voiceProcessing' as PlaybackMode,
  enableBuffering: true,
  bufferConfig: {
    targetBufferMs: 100,
    maxBufferMs: 500,
    minBufferMs: 50
  }
};

await ExpoStreamer.setSoundConfig(soundConfig);

// Use typed encoding constants
await ExpoStreamer.playAudio(
  audioData, 
  'turn-1', 
  EncodingTypes.PCM_S16LE
);
```

### Voice-Optimized Configuration

```typescript
// Voice processing with 24000 Hz sample rate (recommended for voice applications)
const voiceConfig: RecordingConfig = {
  sampleRate: 24000 as SampleRate,  // Voice-optimized sample rate
  channels: 1,                      // Mono for voice
  encoding: 'pcm_16bit' as RecordingEncodingType,
  interval: 50,                     // Fast response for real-time voice
  onAudioStream: async (event: AudioDataEvent) => {
    // Process voice data with optimal settings
    console.log('Voice data:', {
      soundLevel: event.soundLevel,
      dataLength: event.data.length
    });
  }
};

const soundConfig: SoundConfig = {
  sampleRate: 24000 as SampleRate,
  playbackMode: 'voiceProcessing' as PlaybackMode,
  enableBuffering: true,
  bufferConfig: {
    targetBufferMs: 50,   // Lower latency for voice
    maxBufferMs: 200,
    minBufferMs: 25
  }
};

await ExpoStreamer.startRecording(voiceConfig);
await ExpoStreamer.setSoundConfig(soundConfig);
```

### Event Handling with TypeScript

```typescript
import { 
  ExpoStreamer, 
  AudioDataEvent, 
  SoundChunkPlayedEventPayload 
} from 'expo-streamer';

// Subscribe to audio events with proper typing
const subscription = ExpoStreamer.subscribeToAudioEvents(
  async (event: AudioDataEvent) => {
    console.log('Audio event:', {
      data: event.data,
      soundLevel: event.soundLevel,
      position: event.position
    });
  }
);

// Subscribe to playback events
const playbackSubscription = ExpoStreamer.subscribeToSoundChunkPlayed(
  async (event: SoundChunkPlayedEventPayload) => {
    console.log('Chunk played:', {
      isFinalChunk: event.isFinalChunk,
      turnId: event.turnId
    });
  }
);

// Clean up subscriptions
subscription?.remove();
playbackSubscription?.remove();
```

## 📋 API Reference

### Core Types

```typescript
interface RecordingConfig {
  sampleRate?: SampleRate;           // 16000 | 24000 | 44100 | 48000
  channels?: number;                 // 1 (mono) or 2 (stereo)
  encoding?: RecordingEncodingType;  // 'pcm_8bit' | 'pcm_16bit' | 'pcm_32bit'
  interval?: number;                 // Callback interval in milliseconds
  onAudioStream?: (event: AudioDataEvent) => void;
}

interface AudioDataEvent {
  data: string;        // Base64 encoded audio data
  position: number;    // Position in the audio stream
  soundLevel?: number; // Audio level for visualization
  eventDataSize: number;
  totalSize: number;
}

interface SoundConfig {
  sampleRate?: SampleRate;
  playbackMode?: PlaybackMode;
  useDefault?: boolean;
  enableBuffering?: boolean;
  bufferConfig?: Partial<IAudioBufferConfig>;
}
```

### Recording Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `startRecording(config: RecordingConfig)` | `Promise<StartRecordingResult>` | Start microphone recording |
| `stopRecording()` | `Promise<AudioRecording>` | Stop recording and return data |
| `pauseRecording()` | `Promise<void>` | Pause current recording |
| `resumeRecording()` | `Promise<void>` | Resume paused recording |

### Playback Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `playAudio(data: string, turnId: string, encoding?: Encoding)` | `Promise<void>` | Play base64 audio data |
| `pauseAudio()` | `Promise<void>` | Pause current playback |
| `stopAudio()` | `Promise<void>` | Stop all audio playback |
| `clearPlaybackQueueByTurnId(turnId: string)` | `Promise<void>` | Clear queue for specific turn |

### Configuration Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `setSoundConfig(config: SoundConfig)` | `Promise<void>` | Configure audio playback |
| `getPermissionsAsync()` | `Promise<PermissionResponse>` | Check microphone permissions |
| `requestPermissionsAsync()` | `Promise<PermissionResponse>` | Request microphone permissions |

## 🧪 Testing

```bash
# Run all tests with TypeScript checking
npm run test:all

# Individual test suites
npm test                    # Jest (TypeScript)
npm run test:ios           # XCTest (iOS)  
npm run test:android       # JUnit (Android)
npm run test:coverage      # Coverage report
```

## 🏗️ Architecture

Built with enterprise-grade patterns and full TypeScript support:

- **🔒 Type Safety**: Comprehensive TypeScript definitions for all APIs
- **🏛️ SOLID Principles**: Single responsibility, dependency injection, interface segregation  
- **🧵 Thread Safety**: Proper synchronization with DispatchQueue (iOS) and Mutex (Android)
- **🛡️ Error Handling**: Result types and graceful degradation
- **💾 Memory Management**: Efficient buffer pooling and automatic cleanup

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone and setup
git clone https://github.com/truemagic-coder/expo-streamer.git
cd expo-streamer
npm install

# Run example app
cd example
npm run ios     # or npm run android
```

### Code Standards

- Full TypeScript support with strict mode
- Follow SOLID principles
- Include comprehensive tests
- Ensure thread safety
- Document all public APIs

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

**Acknowledgments**: This project is a hard fork based on original work by Alexander Demchuk, also under MIT License.

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/truemagic-coder/expo-streamer/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/truemagic-coder/expo-streamer/discussions)
- 📖 **Documentation**: [GitHub Wiki](https://github.com/truemagic-coder/expo-streamer/wiki)

---

<div align="center">
  <strong>Built with ❤️ for the Expo community</strong>
</div>