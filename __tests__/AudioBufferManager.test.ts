import { BufferManagerAdaptive } from '../src/audio/BufferManagerAdaptive';
import { QualityMonitor } from '../src/audio/QualityMonitor';
import { AudioBufferManager } from '../src/audio/BufferManagerCore';
import { EncodingTypes, SmartBufferMode } from '../src/types';

describe('BufferManagerAdaptive', () => {
  let bufferManager: BufferManagerAdaptive;
  const mockTurnId = 'test-turn-123';
  
  beforeEach(() => {
    const config = {
      mode: 'balanced' as SmartBufferMode,
      adaptiveThresholds: {
        highLatencyMs: 150,
        highJitterMs: 50,
        packetLossPercent: 1.0
      }
    };
    bufferManager = new BufferManagerAdaptive(config, mockTurnId, EncodingTypes.PCM_S16LE);
  });

  test('should initialize with correct configuration', () => {
    expect(bufferManager).toBeDefined();
  });

  test('should handle audio chunk processing without throwing', async () => {
    const audioData = {
      audioData: 'test-base64-data',
      sequenceNumber: 1
    };

    const mockDirectPlayCallback = jest.fn().mockResolvedValue(undefined);

    await expect(
      bufferManager.processAudioChunk(audioData, mockDirectPlayCallback)
    ).resolves.not.toThrow();
  });

  test('should call direct play callback when buffering is disabled', async () => {
    const audioData = {
      audioData: 'test-base64-data',
      sequenceNumber: 1
    };

    const mockDirectPlayCallback = jest.fn().mockResolvedValue(undefined);

    await bufferManager.processAudioChunk(audioData, mockDirectPlayCallback);

    expect(mockDirectPlayCallback).toHaveBeenCalledWith(
      audioData.audioData,
      mockTurnId,
      EncodingTypes.PCM_S16LE
    );
  });
});

describe('QualityMonitor', () => {
  let qualityMonitor: QualityMonitor;

  beforeEach(() => {
    qualityMonitor = new QualityMonitor(20); // 20ms frame interval
  });

  test('should initialize with default values', () => {
    const metrics = qualityMonitor.getMetrics();
    
    expect(metrics.underrunCount).toBe(0);
    expect(metrics.overrunCount).toBe(0);
    expect(metrics.averageJitter).toBe(0);
    expect(metrics.adaptiveAdjustmentsCount).toBe(0);
  });

  test('should record frame arrivals and update jitter', () => {
    const now = Date.now();
    
    qualityMonitor.recordFrameArrival(now);
    qualityMonitor.recordFrameArrival(now + 25); // 25ms later (5ms jitter)
    qualityMonitor.recordFrameArrival(now + 45); // 20ms interval
    
    const metrics = qualityMonitor.getMetrics();
    expect(metrics.averageJitter).toBeGreaterThan(0);
  });

  test('should record underruns and overruns', () => {
    qualityMonitor.recordUnderrun();
    qualityMonitor.recordUnderrun();
    qualityMonitor.recordOverrun();
    
    const metrics = qualityMonitor.getMetrics();
    expect(metrics.underrunCount).toBe(2);
    expect(metrics.overrunCount).toBe(1);
  });

  test('should provide buffer health state assessment', () => {
    // Test idle state
    let healthState = qualityMonitor.getBufferHealthState(false, 0);
    expect(healthState).toBe('idle');
    
    // Test critical state with low buffer
    qualityMonitor.updateBufferLevel(30); // 30ms buffer (below 50ms threshold)
    healthState = qualityMonitor.getBufferHealthState(true, 0);
    expect(healthState).toBe('critical');
  });

  test('should provide adaptive recommendations', () => {
    // Simulate underrun scenario
    for (let i = 0; i < 10; i++) {
      qualityMonitor.recordFrameArrival(Date.now() + i * 20);
    }
    
    qualityMonitor.recordUnderrun();
    qualityMonitor.recordUnderrun();
    
    const adjustment = qualityMonitor.getRecommendedAdjustment();
    expect(adjustment).toBeGreaterThan(0); // Should recommend increasing buffer
  });

  test('should reset metrics correctly', () => {
    qualityMonitor.recordUnderrun();
    qualityMonitor.recordOverrun();
    qualityMonitor.updateBufferLevel(100);
    
    qualityMonitor.reset();
    
    const metrics = qualityMonitor.getMetrics();
    expect(metrics.underrunCount).toBe(0);
    expect(metrics.overrunCount).toBe(0);
    expect(metrics.currentBufferMs).toBe(0);
  });
});

describe('AudioBufferManager', () => {
  let bufferManager: AudioBufferManager;

  beforeEach(() => {
    bufferManager = new AudioBufferManager({
      targetBufferMs: 240,
      minBufferMs: 120,
      maxBufferMs: 480,
      frameIntervalMs: 20
    });
  });

  test('should initialize with correct configuration', () => {
    expect(bufferManager).toBeDefined();
    expect(bufferManager.isPlaying()).toBe(false);
    expect(bufferManager.getCurrentBufferMs()).toBe(0);
  });

  test('should start and stop playback', () => {
    bufferManager.startPlayback();
    expect(bufferManager.isPlaying()).toBe(true);
    
    bufferManager.stopPlayback();
    expect(bufferManager.isPlaying()).toBe(false);
  });

  test('should handle buffer health metrics', () => {
    const metrics = bufferManager.getHealthMetrics();
    
    expect(metrics).toHaveProperty('currentBufferMs');
    expect(metrics).toHaveProperty('targetBufferMs');
    expect(metrics).toHaveProperty('underrunCount');
    expect(metrics).toHaveProperty('overrunCount');
    expect(metrics).toHaveProperty('averageJitter');
    expect(metrics).toHaveProperty('bufferHealthState');
  });

  test('should update configuration', () => {
    const newConfig = { targetBufferMs: 300 };
    
    bufferManager.updateConfig(newConfig);
    
    const metrics = bufferManager.getHealthMetrics();
    expect(metrics.targetBufferMs).toBe(300);
  });

  test('should clean up resources on destroy', () => {
    bufferManager.startPlayback();
    expect(bufferManager.isPlaying()).toBe(true);
    
    bufferManager.destroy();
    expect(bufferManager.isPlaying()).toBe(false);
    expect(bufferManager.getCurrentBufferMs()).toBe(0);
  });
});

describe('Thread Safety Tests', () => {
  test('should handle concurrent buffer operations', async () => {
    const bufferManager = new AudioBufferManager();
    const promises: Promise<void>[] = [];
    
    // Simulate concurrent operations
    for (let i = 0; i < 50; i++) {
      promises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            bufferManager.updateConfig({ targetBufferMs: 200 + i });
            const metrics = bufferManager.getHealthMetrics();
            expect(metrics).toBeDefined();
            resolve();
          }, Math.random() * 10);
        })
      );
    }
    
    await Promise.all(promises);
    expect(bufferManager.getHealthMetrics().targetBufferMs).toBeGreaterThan(200);
  });

  test('should handle rapid start/stop cycles', async () => {
    const bufferManager = new AudioBufferManager();
    const cycles = 20;
    
    for (let i = 0; i < cycles; i++) {
      bufferManager.startPlayback();
      expect(bufferManager.isPlaying()).toBe(true);
      
      bufferManager.stopPlayback();
      expect(bufferManager.isPlaying()).toBe(false);
    }
  });
});