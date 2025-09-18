/**
 * expo-streamer TypeScript Example
 * 
 * This example demonstrates how to use expo-streamer with full TypeScript support
 */

import { 
  ExpoStreamer,
  RecordingConfig,
  AudioDataEvent,
  SoundConfig,
  EncodingTypes,
  SampleRate,
  PlaybackMode
} from 'expo-streamer';

// Example 1: Basic Recording with Type Safety
async function basicRecordingExample(): Promise<void> {
  try {
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
          soundLevel: event.soundLevel,
          eventDataSize: event.eventDataSize,
          totalSize: event.totalSize
        });
      }
    };

    // Start recording with type safety
    const { recordingResult, subscription } = await ExpoStreamer.startRecording(recordingConfig);
    
    console.log('Recording started:', recordingResult);
    
    // Stop recording after 5 seconds
    setTimeout(async () => {
      const recording = await ExpoStreamer.stopRecording();
      console.log('Recording stopped:', recording);
      
      // Clean up subscription
      subscription?.remove();
    }, 5000);
    
  } catch (error) {
    console.error('Recording error:', error);
  }
}

// Example 2: Advanced Audio Configuration
async function advancedConfigurationExample(): Promise<void> {
  try {
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
    console.log('Sound configuration applied');

    // Play audio with typed encoding
    const audioData = 'base64AudioDataHere';
    await ExpoStreamer.playAudio(audioData, 'turn-1', EncodingTypes.PCM_S16LE);
    
  } catch (error) {
    console.error('Configuration error:', error);
  }
}

// Example 3: Event Handling with TypeScript
function eventHandlingExample(): void {
  // Subscribe to audio events with proper typing
  const audioSubscription = ExpoStreamer.subscribeToAudioEvents(
    async (event: AudioDataEvent) => {
      console.log('Audio event received:', {
        dataLength: event.data.length,
        position: event.position,
        soundLevel: event.soundLevel || 0
      });
      
      // Process audio data here
      // The data is properly typed as string (base64)
    }
  );

  // Subscribe to playback events
  const playbackSubscription = ExpoStreamer.subscribeToSoundChunkPlayed(
    async (event) => {
      console.log('Chunk played:', {
        isFinalChunk: event.isFinalChunk,
        turnId: event.turnId
      });
    }
  );

  // Clean up subscriptions when done
  setTimeout(() => {
    audioSubscription.remove();
    playbackSubscription.remove();
  }, 30000);
}

// Example 4: Error Handling with TypeScript
async function errorHandlingExample(): Promise<void> {
  try {
    // Type-safe recording configuration
    const config: RecordingConfig = {
      sampleRate: 44100,
      channels: 1,
      onAudioStream: (event: AudioDataEvent) => {
        // Handle audio stream
        if (event.data && event.data.length > 0) {
          console.log(`Received ${event.data.length} bytes of audio data`);
        }
      }
    };

    const result = await ExpoStreamer.startRecording(config);
    
    // TypeScript ensures we handle the correct return type
    if (result.recordingResult) {
      console.log('Recording started successfully');
    }
    
  } catch (error) {
    // TypeScript knows error is unknown, so we properly handle it
    if (error instanceof Error) {
      console.error('Recording failed:', error.message);
    } else {
      console.error('Unknown error occurred:', error);
    }
  }
}

// Example 5: Permissions with TypeScript
async function permissionsExample(): Promise<void> {
  try {
    // Check permissions with proper typing
    const permissionStatus = await ExpoStreamer.getPermissionsAsync();
    console.log('Current permissions:', permissionStatus);
    
    if (!permissionStatus.granted) {
      // Request permissions
      const requestResult = await ExpoStreamer.requestPermissionsAsync();
      
      if (requestResult.granted) {
        console.log('Permissions granted');
        // Proceed with audio operations
      } else {
        console.log('Permissions denied');
        // Handle denied permissions
      }
    }
    
  } catch (error) {
    console.error('Permission error:', error);
  }
}

// Export examples for use in your app
export {
  basicRecordingExample,
  advancedConfigurationExample,
  eventHandlingExample,
  errorHandlingExample,
  permissionsExample
};