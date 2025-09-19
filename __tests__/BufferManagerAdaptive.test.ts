import { BufferManagerAdaptive } from '../src/audio/BufferManagerAdaptive';
import { EncodingTypes, SmartBufferConfig } from '../src/types';

// Mock the BufferManagerCore
jest.mock('../src/audio/BufferManagerCore', () => ({
  AudioBufferManager: jest.fn().mockImplementation(() => ({
    setTurnId: jest.fn(),
    setEncoding: jest.fn(),
    startPlayback: jest.fn(),
    stopPlayback: jest.fn(),
    destroy: jest.fn(),
    enqueueFrames: jest.fn(),
    getHealthMetrics: jest.fn().mockReturnValue({
      currentBufferMs: 100,
      targetBufferMs: 200,
      underrunCount: 0,
      overrunCount: 0,
      averageJitter: 5,
      bufferHealthState: 'healthy',
      adaptiveAdjustmentsCount: 0,
    }),
  })),
}));

describe('BufferManagerAdaptive', () => {
  let adaptiveManager: BufferManagerAdaptive;
  const turnId = 'test-turn-123';
  const mockDirectPlayCallback = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    mockDirectPlayCallback.mockClear();
  });

  describe('Initialization', () => {
    test('should initialize with conservative mode', () => {
      const config: SmartBufferConfig = { mode: 'conservative' };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      expect(adaptiveManager).toBeDefined();
      expect(adaptiveManager.isBufferingEnabled()).toBe(false);
    });

    test('should initialize with custom encoding', () => {
      const config: SmartBufferConfig = { mode: 'balanced' };
      adaptiveManager = new BufferManagerAdaptive(config, turnId, EncodingTypes.PCM_S16LE);
      expect(adaptiveManager).toBeDefined();
    });

    test('should initialize with network conditions', () => {
      const config: SmartBufferConfig = {
        mode: 'balanced',
        networkConditions: {
          latency: 100,
          jitter: 20,
          packetLoss: 1.5,
        },
      };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      expect(adaptiveManager).toBeDefined();
    });
  });

  describe('Audio Chunk Processing', () => {
    beforeEach(() => {
      const config: SmartBufferConfig = { mode: 'balanced' };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
    });

    test('should process audio chunk with direct playback when buffering disabled', async () => {
      const audioData = {
        audioData: 'dGVzdCBhdWRpbyBkYXRh',
        isFirst: true,
        isFinal: false,
      };

      await adaptiveManager.processAudioChunk(audioData, mockDirectPlayCallback);
      
      expect(mockDirectPlayCallback).toHaveBeenCalledWith(
        audioData.audioData,
        turnId,
        EncodingTypes.PCM_S16LE
      );
    });

    test('should process audio chunk with buffering when enabled', async () => {
      const config: SmartBufferConfig = {
        mode: 'aggressive',
        networkConditions: { latency: 300 },
      };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);

      const audioData = {
        audioData: 'dGVzdCBhdWRpbyBkYXRh',
        isFirst: true,
        isFinal: false,
      };

      await adaptiveManager.processAudioChunk(audioData, mockDirectPlayCallback);
      expect(mockDirectPlayCallback).not.toHaveBeenCalled();
    });
  });

  describe('Buffering Mode Logic', () => {
    test('conservative mode should buffer only on severe network problems', async () => {
      const config: SmartBufferConfig = {
        mode: 'conservative',
        networkConditions: { latency: 300 },
      };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      
      const audioData = { audioData: 'dGVzdA==', isFirst: true, isFinal: false };
      await adaptiveManager.processAudioChunk(audioData, mockDirectPlayCallback);
      
      expect(adaptiveManager.isBufferingEnabled()).toBe(true);
    });

    test('balanced mode should buffer on moderate network issues', async () => {
      const config: SmartBufferConfig = {
        mode: 'balanced',
        networkConditions: { latency: 160 },
      };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      
      const audioData = { audioData: 'dGVzdA==', isFirst: true, isFinal: false };
      await adaptiveManager.processAudioChunk(audioData, mockDirectPlayCallback);
      
      expect(adaptiveManager.isBufferingEnabled()).toBe(true);
    });

    test('aggressive mode should buffer proactively', async () => {
      const config: SmartBufferConfig = {
        mode: 'aggressive',
        networkConditions: { latency: 110 },
      };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      
      const audioData = { audioData: 'dGVzdA==', isFirst: true, isFinal: false };
      await adaptiveManager.processAudioChunk(audioData, mockDirectPlayCallback);
      
      expect(adaptiveManager.isBufferingEnabled()).toBe(true);
    });

    test('adaptive mode should use dynamic decision making', async () => {
      const config: SmartBufferConfig = {
        mode: 'adaptive',
        networkConditions: { latency: 160 },
      };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      
      const audioData = { audioData: 'dGVzdA==', isFirst: true, isFinal: false };
      await adaptiveManager.processAudioChunk(audioData, mockDirectPlayCallback);
      
      expect(adaptiveManager.isBufferingEnabled()).toBe(true);
    });
  });

  describe('Health Metrics', () => {
    test('should return buffer health metrics when buffering enabled', async () => {
      const config: SmartBufferConfig = {
        mode: 'aggressive',
        networkConditions: { latency: 200 },
      };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      
      const audioData = { audioData: 'dGVzdA==', isFirst: true, isFinal: false };
      await adaptiveManager.processAudioChunk(audioData, mockDirectPlayCallback);
      
      const metrics = adaptiveManager.getHealthMetrics();
      expect(metrics).toBeDefined();
      expect(metrics?.currentBufferMs).toBeDefined();
    });

    test('should return basic metrics when buffering disabled', () => {
      const config: SmartBufferConfig = { mode: 'conservative' };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      
      const metrics = adaptiveManager.getHealthMetrics();
      expect(metrics).toBeDefined();
      expect(metrics?.currentBufferMs).toBe(0);
      expect(metrics?.targetBufferMs).toBe(0);
      expect(metrics?.bufferHealthState).toBe('idle');
    });
  });

  describe('Lifecycle Management', () => {
    test('should properly destroy and clean up', async () => {
      const config: SmartBufferConfig = {
        mode: 'aggressive',
        networkConditions: { latency: 200 },
      };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      
      const audioData = { audioData: 'dGVzdA==', isFirst: true, isFinal: false };
      await adaptiveManager.processAudioChunk(audioData, mockDirectPlayCallback);
      
      expect(() => {
        adaptiveManager.destroy();
      }).not.toThrow();
    });
  });

  describe('Network Conditions Management', () => {
    test('should update network conditions externally', () => {
      const config: SmartBufferConfig = { mode: 'balanced' };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      
      adaptiveManager.updateNetworkConditions({ latency: 150 });
      expect(adaptiveManager).toBeDefined();
    });
  });

  describe('Buffer Configuration Edge Cases', () => {
    test('should adjust buffer config for high jitter conditions', async () => {
      const config: SmartBufferConfig = {
        mode: 'aggressive',
        networkConditions: {
          latency: 150,
          jitter: 60, // High jitter > 50
        },
      };
      adaptiveManager = new BufferManagerAdaptive(config, turnId);
      
      const audioData = { audioData: 'dGVzdA==', isFirst: true, isFinal: false };
      await adaptiveManager.processAudioChunk(audioData, mockDirectPlayCallback);
      
      expect(adaptiveManager.isBufferingEnabled()).toBe(true);
    });
  });
});