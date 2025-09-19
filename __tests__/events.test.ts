// Mock the native module
jest.mock('../src/ExpoPlayAudioStreamModule', () => ({}));

// Mock expo-modules-core EventEmitter
const mockAddListener = jest.fn();
jest.mock('expo-modules-core', () => ({
  EventEmitter: jest.fn().mockImplementation(() => ({
    addListener: mockAddListener,
  })),
}));

import { 
  addAudioEventListener, 
  addSoundChunkPlayedListener, 
  subscribeToEvent,
  AudioEvents,
  DeviceReconnectedReasons,
  type AudioEventPayload,
  type SoundChunkPlayedEventPayload 
} from '../src/events';

describe('Events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Constants', () => {
    test('should have correct AudioEvents constants', () => {
      expect(AudioEvents.AudioData).toBe('AudioData');
      expect(AudioEvents.SoundChunkPlayed).toBe('SoundChunkPlayed');
      expect(AudioEvents.SoundStarted).toBe('SoundStarted');
      expect(AudioEvents.DeviceReconnected).toBe('DeviceReconnected');
    });

    test('should have correct DeviceReconnectedReasons constants', () => {
      expect(DeviceReconnectedReasons.newDeviceAvailable).toBe('newDeviceAvailable');
      expect(DeviceReconnectedReasons.oldDeviceUnavailable).toBe('oldDeviceUnavailable');
      expect(DeviceReconnectedReasons.unknown).toBe('unknown');
    });
  });

  describe('Event Listeners', () => {
    test('should add audio event listener', () => {
      const mockListener = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      mockAddListener.mockReturnValue(mockSubscription);

      const subscription = addAudioEventListener(mockListener);

      expect(mockAddListener).toHaveBeenCalledWith('AudioData', expect.any(Function));
      expect(subscription).toBe(mockSubscription);
    });

    test('should add sound chunk played listener', () => {
      const mockListener = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      mockAddListener.mockReturnValue(mockSubscription);

      const subscription = addSoundChunkPlayedListener(mockListener);

      expect(mockAddListener).toHaveBeenCalledWith('SoundChunkPlayed', expect.any(Function));
      expect(subscription).toBe(mockSubscription);
    });

    test('should subscribe to custom event', () => {
      const mockListener = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      mockAddListener.mockReturnValue(mockSubscription);

      const subscription = subscribeToEvent('CustomEvent', mockListener);

      expect(mockAddListener).toHaveBeenCalledWith('CustomEvent', expect.any(Function));
      expect(subscription).toBe(mockSubscription);
    });
  });

  describe('Error Handling', () => {
    test('should handle errors in audio event listener', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorListener = jest.fn().mockRejectedValue(new Error('Test error'));
      const mockSubscription = { remove: jest.fn() };
      mockAddListener.mockReturnValue(mockSubscription);

      addAudioEventListener(errorListener);
      
      // Get the wrapped listener that was passed to addListener
      const wrappedListener = mockAddListener.mock.calls[0][1];
      
      // Call the wrapped listener with test data
      wrappedListener({ fileUri: 'test', position: 0, totalSize: 100 });

      // Wait for the promise to be handled
      return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
        expect(consoleSpy).toHaveBeenCalledWith(new Error('Test error'));
        consoleSpy.mockRestore();
      });
    });

    test('should handle errors in sound chunk played listener', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorListener = jest.fn().mockRejectedValue(new Error('Chunk error'));
      const mockSubscription = { remove: jest.fn() };
      mockAddListener.mockReturnValue(mockSubscription);

      addSoundChunkPlayedListener(errorListener);
      
      // Get the wrapped listener that was passed to addListener
      const wrappedListener = mockAddListener.mock.calls[0][1];
      
      // Call the wrapped listener with test data
      wrappedListener({ isFinal: true });

      // Wait for the promise to be handled
      return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
        expect(consoleSpy).toHaveBeenCalledWith(new Error('Chunk error'));
        consoleSpy.mockRestore();
      });
    });

    test('should handle errors in custom event listener', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorListener = jest.fn().mockRejectedValue(new Error('Custom error'));
      const mockSubscription = { remove: jest.fn() };
      mockAddListener.mockReturnValue(mockSubscription);

      subscribeToEvent('CustomEvent', errorListener);
      
      // Get the wrapped listener that was passed to addListener
      const wrappedListener = mockAddListener.mock.calls[0][1];
      
      // Call the wrapped listener with test data
      wrappedListener({ customData: 'test' });

      // Wait for the promise to be handled
      return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
        expect(consoleSpy).toHaveBeenCalledWith(new Error('Custom error'));
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Type Interfaces', () => {
    test('should support AudioEventPayload interface', () => {
      const eventPayload: AudioEventPayload = {
        fileUri: 'test://file.wav',
        lastEmittedSize: 100,
        position: 50,
        deltaSize: 25,
        totalSize: 1000,
        mimeType: 'audio/wav',
        streamUuid: 'test-uuid-123',
      };

      expect(eventPayload.fileUri).toBe('test://file.wav');
      expect(eventPayload.totalSize).toBe(1000);
    });

    test('should support SoundChunkPlayedEventPayload interface', () => {
      const eventPayload: SoundChunkPlayedEventPayload = {
        isFinal: true,
      };

      expect(eventPayload.isFinal).toBe(true);
    });
  });
});