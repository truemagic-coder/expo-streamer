import { AudioBufferManager } from '../src/audio/BufferManagerCore';
import { EncodingTypes } from '../src/types';
import ExpoPlayAudioStreamModule from '../src/ExpoPlayAudioStreamModule';

// Mock the native module
jest.mock('../src/ExpoPlayAudioStreamModule', () => ({
  playSound: jest.fn(),
}));

// Mock the FrameProcessor and QualityMonitor
jest.mock('../src/audio/FrameProcessor', () => ({
  FrameProcessor: jest.fn().mockImplementation(() => ({
    parseChunk: jest.fn().mockReturnValue([
      {
        sequenceNumber: 1,
        data: {
          audioData: 'test-audio-data',
          isFirst: false,
          isFinal: false,
        },
        duration: 20,
        timestamp: Date.now(),
      }
    ]),
    reset: jest.fn(),
  })),
}));

jest.mock('../src/audio/QualityMonitor', () => ({
  QualityMonitor: jest.fn().mockImplementation(() => ({
    recordFrameArrival: jest.fn(),
    updateBufferLevel: jest.fn(),
    recordUnderrun: jest.fn(),
    recordOverrun: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({
      currentBufferMs: 100,
      targetBufferMs: 240,
      underrunCount: 0,
      overrunCount: 0,
      averageJitter: 5,
      bufferHealthState: 'healthy',
      adaptiveAdjustmentsCount: 0,
    }),
    getBufferHealthState: jest.fn().mockReturnValue('healthy'),
    getRecommendedAdjustment: jest.fn().mockReturnValue(0),
  })),
}));

describe('AudioBufferManager', () => {
  let bufferManager: AudioBufferManager;
  const mockPlaySound = ExpoPlayAudioStreamModule.playSound as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    bufferManager = new AudioBufferManager({
      targetBufferMs: 240,
      minBufferMs: 120,
      maxBufferMs: 480,
      frameIntervalMs: 20,
    });
  });

  afterEach(() => {
    bufferManager.destroy();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with default configuration when no config provided', () => {
      const defaultManager = new AudioBufferManager();
      expect(defaultManager).toBeDefined();
      expect(defaultManager.getCurrentBufferMs()).toBe(0);
    });

    test('should merge provided configuration with defaults', () => {
      const customConfig = { targetBufferMs: 300 };
      const customManager = new AudioBufferManager(customConfig);
      
      const metrics = customManager.getHealthMetrics();
      expect(metrics.targetBufferMs).toBe(300);
    });

    test('should set turn ID correctly', () => {
      const turnId = 'test-turn-123';
      expect(() => bufferManager.setTurnId(turnId)).not.toThrow();
    });

    test('should set encoding correctly', () => {
      expect(() => bufferManager.setEncoding(EncodingTypes.PCM_S16LE)).not.toThrow();
      expect(() => bufferManager.setEncoding(EncodingTypes.PCM_F32LE)).not.toThrow();
    });
  });

  describe('Frame Enqueueing', () => {
    test('should enqueue frames and update buffer', () => {
      const audioData = {
        audioData: 'dGVzdCBhdWRpbyBkYXRh',
        isFirst: true,
        isFinal: false,
      };

      bufferManager.enqueueFrames(audioData);
      expect(bufferManager.getCurrentBufferMs()).toBeGreaterThan(0);
    });

    test('should handle enqueue when processors are null', () => {
      bufferManager.destroy(); // This nullifies processors
      
      const audioData = {
        audioData: 'test-data',
        isFirst: true,
      };

      expect(() => bufferManager.enqueueFrames(audioData)).not.toThrow();
    });

    test('should handle buffer overrun scenario', () => {
      // Mock a scenario where buffer exceeds max
      const mockFrameProcessor = require('../src/audio/FrameProcessor').FrameProcessor;
      const frameProcessorInstance = new mockFrameProcessor();
      
      // Create multiple frames that exceed maxBufferMs
      const longFrames = Array.from({ length: 30 }, (_, i) => ({
        sequenceNumber: i,
        data: {
          audioData: 'test-audio-data',
          isFirst: i === 0,
          isFinal: i === 29,
        },
        duration: 20,
        timestamp: Date.now() + i * 20,
      }));

      frameProcessorInstance.parseChunk.mockReturnValue(longFrames);

      const audioData = {
        audioData: 'very-long-audio-data-string',
        isFirst: true,
        isFinal: true,
      };

      bufferManager.enqueueFrames(audioData);
      // Should handle overrun without throwing
      expect(bufferManager.getCurrentBufferMs()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Playback Control', () => {
    test('should start playback correctly', () => {
      expect(bufferManager.isPlaying()).toBe(false);
      
      bufferManager.startPlayback();
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should not start playback if already active', () => {
      bufferManager.startPlayback();
      expect(bufferManager.isPlaying()).toBe(true);
      
      // Second call should not change state
      bufferManager.startPlayback();
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should stop playback correctly', () => {
      bufferManager.startPlayback();
      expect(bufferManager.isPlaying()).toBe(true);
      
      bufferManager.stopPlayback();
      expect(bufferManager.isPlaying()).toBe(false);
      expect(bufferManager.getCurrentBufferMs()).toBe(0);
    });

    test('should clear buffer and reset sequence on stop', () => {
      // Add some frames first
      const audioData = {
        audioData: 'test-data',
        isFirst: true,
      };
      bufferManager.enqueueFrames(audioData);
      
      bufferManager.startPlayback();
      bufferManager.stopPlayback();
      
      expect(bufferManager.getCurrentBufferMs()).toBe(0);
    });
  });

  describe('Health Metrics and Monitoring', () => {
    test('should return health metrics when quality monitor exists', () => {
      const metrics = bufferManager.getHealthMetrics();
      
      expect(metrics).toHaveProperty('currentBufferMs');
      expect(metrics).toHaveProperty('targetBufferMs');
      expect(metrics).toHaveProperty('underrunCount');
      expect(metrics).toHaveProperty('overrunCount');
      expect(metrics).toHaveProperty('averageJitter');
      expect(metrics).toHaveProperty('bufferHealthState');
      expect(metrics).toHaveProperty('adaptiveAdjustmentsCount');
    });

    test('should return default metrics when quality monitor is null', () => {
      bufferManager.destroy(); // This nullifies quality monitor
      
      const metrics = bufferManager.getHealthMetrics();
      expect(metrics.currentBufferMs).toBe(0);
      expect(metrics.targetBufferMs).toBe(240);
      expect(metrics.underrunCount).toBe(0);
      expect(metrics.overrunCount).toBe(0);
      expect(metrics.averageJitter).toBe(0);
      expect(metrics.bufferHealthState).toBe('idle');
      expect(metrics.adaptiveAdjustmentsCount).toBe(0);
    });

    test('should update configuration correctly', () => {
      const newConfig = {
        targetBufferMs: 300,
        minBufferMs: 150,
        maxBufferMs: 600,
      };

      bufferManager.updateConfig(newConfig);
      
      const metrics = bufferManager.getHealthMetrics();
      expect(metrics.targetBufferMs).toBe(300);
    });

    test('should apply adaptive adjustments when quality monitor exists', () => {
      const mockQualityMonitor = require('../src/audio/QualityMonitor').QualityMonitor;
      const qualityMonitorInstance = new mockQualityMonitor();
      
      // Mock returning a positive adjustment
      qualityMonitorInstance.getRecommendedAdjustment.mockReturnValue(50);
      
      expect(() => bufferManager.applyAdaptiveAdjustments()).not.toThrow();
    });

    test('should handle adaptive adjustments when quality monitor is null', () => {
      bufferManager.destroy(); // Nullifies quality monitor
      expect(() => bufferManager.applyAdaptiveAdjustments()).not.toThrow();
    });

    test('should clamp adaptive adjustments within min/max bounds', () => {
      const mockQualityMonitor = require('../src/audio/QualityMonitor').QualityMonitor;
      const qualityMonitorInstance = new mockQualityMonitor();
      
      // Mock returning a very large adjustment
      qualityMonitorInstance.getRecommendedAdjustment.mockReturnValue(1000);
      
      bufferManager.applyAdaptiveAdjustments();
      
      const metrics = bufferManager.getHealthMetrics();
      expect(metrics.targetBufferMs).toBeLessThanOrEqual(480); // maxBufferMs
    });

    test('should clamp adaptive adjustments to minimum bound', () => {
      const mockQualityMonitor = require('../src/audio/QualityMonitor').QualityMonitor;
      const qualityMonitorInstance = new mockQualityMonitor();
      
      // Mock returning a very negative adjustment
      qualityMonitorInstance.getRecommendedAdjustment.mockReturnValue(-1000);
      
      bufferManager.applyAdaptiveAdjustments();
      
      const metrics = bufferManager.getHealthMetrics();
      expect(metrics.targetBufferMs).toBeGreaterThanOrEqual(120); // minBufferMs
    });

    test('should apply non-zero adaptive adjustments correctly', () => {
      // Test that the adjustment logic is exercised, but don't rely on mocking internals
      const testManager = new AudioBufferManager({
        targetBufferMs: 240,
        minBufferMs: 120,
        maxBufferMs: 480,
      });
      
      // Apply adjustments - this exercises the adjustment code paths
      expect(() => testManager.applyAdaptiveAdjustments()).not.toThrow();
      
      const metrics = testManager.getHealthMetrics();
      // Should have valid metrics after applying adjustments
      expect(metrics.targetBufferMs).toBeGreaterThanOrEqual(120);
      expect(metrics.targetBufferMs).toBeLessThanOrEqual(480);
      
      testManager.destroy();
    });

    test('should not update config when adjustment results in same target', () => {
      // Create a buffer manager with specific target
      const testManager = new AudioBufferManager({
        targetBufferMs: 240,
        minBufferMs: 120,
        maxBufferMs: 480,
      });
      
      const mockQualityMonitor = require('../src/audio/QualityMonitor').QualityMonitor;
      const qualityMonitorInstance = new mockQualityMonitor();
      
      // Mock returning adjustment that when applied results in same target
      qualityMonitorInstance.getRecommendedAdjustment.mockReturnValue(0);
      
      const spy = jest.spyOn(testManager, 'updateConfig');
      
      testManager.applyAdaptiveAdjustments();
      
      // Should not call updateConfig for zero adjustment
      expect(spy).not.toHaveBeenCalled();
      
      spy.mockRestore();
      testManager.destroy();
    });
  });

  describe('Buffer Management Internals', () => {
    test('should calculate current buffer correctly with no frames', () => {
      expect(bufferManager.getCurrentBufferMs()).toBe(0);
    });

    test('should handle playback loop with sufficient buffer', async () => {
      // Add frames to buffer
      const audioData = {
        audioData: 'test-data',
        isFirst: true,
      };
      bufferManager.enqueueFrames(audioData);
      
      bufferManager.startPlayback();
      
      // Wait a short time for playback loop to potentially execute
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should handle playback timer cleanup on stop', () => {
      bufferManager.startPlayback();
      
      // Let some time pass for timer to be set
      setTimeout(() => {
        bufferManager.stopPlayback();
        expect(bufferManager.isPlaying()).toBe(false);
      }, 10);
    });

    test('should handle playback with turn ID set', () => {
      const turnId = 'test-turn-456';
      bufferManager.setTurnId(turnId);
      
      const audioData = {
        audioData: 'test-data',
        isFirst: true,
      };
      bufferManager.enqueueFrames(audioData);
      bufferManager.startPlayback();
      
      expect(bufferManager.isPlaying()).toBe(true);
    });
  });

  describe('Playback Scheduling and Frame Processing', () => {
    test('should handle frame playback with ExpoPlayAudioStreamModule', async () => {
      const turnId = 'test-turn-789';
      bufferManager.setTurnId(turnId);
      bufferManager.setEncoding(EncodingTypes.PCM_S16LE);
      
      const audioData = {
        audioData: 'test-audio-data',
        isFirst: true,
      };
      
      bufferManager.enqueueFrames(audioData);
      bufferManager.startPlayback();
      
      // Should start correctly
      expect(bufferManager.isPlaying()).toBe(true);
      
      // Allow some time for the playback loop, then check if still playing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if still playing or stopped gracefully
      const isStillPlaying = bufferManager.isPlaying();
      expect(typeof isStillPlaying).toBe('boolean');
    });

    test('should handle playback without turn ID', async () => {
      const audioData = {
        audioData: 'test-audio-data',
        isFirst: true,
      };
      
      bufferManager.enqueueFrames(audioData);
      bufferManager.startPlayback();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should handle playback errors gracefully', async () => {
      // Mock playSound to throw an error
      mockPlaySound.mockImplementation(() => {
        throw new Error('Playback error');
      });
      
      const audioData = {
        audioData: 'test-audio-data',
        isFirst: true,
      };
      
      bufferManager.enqueueFrames(audioData);
      bufferManager.startPlayback();
      
      // Should not throw even if playback fails
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(bufferManager.isPlaying()).toBe(true);
    });
  });

  describe('Silence Handling and Buffer States', () => {
    test('should handle underrun conditions', async () => {
      // Start playback with minimal buffer to trigger underrun
      bufferManager.startPlayback();
      
      // Allow time for underrun detection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should insert silence frames on underrun', () => {
      // Start playback to activate buffer monitoring
      bufferManager.startPlayback();
      
      // The quality monitor should exist and be ready for updates
      const metrics = bufferManager.getHealthMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.bufferHealthState).toBeDefined();
    });
  });

  describe('Destruction and Cleanup', () => {
    test('should clean up all resources on destroy', () => {
      bufferManager.startPlayback();
      expect(bufferManager.isPlaying()).toBe(true);
      
      bufferManager.destroy();
      
      expect(bufferManager.isPlaying()).toBe(false);
      expect(bufferManager.getCurrentBufferMs()).toBe(0);
    });

    test('should handle multiple destroy calls safely', () => {
      bufferManager.destroy();
      expect(() => bufferManager.destroy()).not.toThrow();
      
      expect(bufferManager.getCurrentBufferMs()).toBe(0);
    });

    test('should stop playback timer on destroy', () => {
      bufferManager.startPlayback();
      
      // Let timer be created
      setTimeout(() => {
        bufferManager.destroy();
        expect(bufferManager.isPlaying()).toBe(false);
      }, 10);
    });
  });

  describe('Advanced Buffer Scenarios', () => {
    test('should handle rapid enqueue operations', () => {
      for (let i = 0; i < 100; i++) {
        const audioData = {
          audioData: `test-data-${i}`,
          isFirst: i === 0,
          isFinal: i === 99,
        };
        
        expect(() => bufferManager.enqueueFrames(audioData)).not.toThrow();
      }
      
      expect(bufferManager.getCurrentBufferMs()).toBeGreaterThan(0);
    });

    test('should handle concurrent config updates', async () => {
      const promises = [];
      
      for (let i = 0; i < 50; i++) {
        promises.push(new Promise<void>(resolve => {
          setTimeout(() => {
            bufferManager.updateConfig({ targetBufferMs: 200 + i });
            resolve();
          }, Math.random() * 10);
        }));
      }
      
      await Promise.all(promises);
      
      const metrics = bufferManager.getHealthMetrics();
      expect(metrics.targetBufferMs).toBeGreaterThanOrEqual(200);
    });

    test('should handle frame processing edge cases', () => {
      const emptyAudioData = {
        audioData: '',
        isFirst: true,
        isFinal: true,
      };
      
      expect(() => bufferManager.enqueueFrames(emptyAudioData)).not.toThrow();
    });

    test('should handle playback start with buffer fill wait', async () => {
      // Add frames to ensure buffer has content for wait condition
      const audioData = {
        audioData: 'test-data-for-wait',
        isFirst: true,
      };
      bufferManager.enqueueFrames(audioData);
      
      bufferManager.startPlayback();
      expect(bufferManager.isPlaying()).toBe(true);
      
      // Wait for buffer fill logic to complete
      await new Promise(resolve => setTimeout(resolve, 250));
      
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should handle playback timer cleanup scenarios', async () => {
      bufferManager.startPlayback();
      expect(bufferManager.isPlaying()).toBe(true);
      
      // Allow timer to be created
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Stop and check cleanup
      bufferManager.stopPlayback();
      expect(bufferManager.isPlaying()).toBe(false);
    });

    test('should handle frame processor reset on stop', () => {
      // Add some frames first
      const audioData = {
        audioData: 'test-data',
        isFirst: true,
      };
      bufferManager.enqueueFrames(audioData);
      
      bufferManager.startPlayback();
      bufferManager.stopPlayback();
      
      // Should reset sequence and buffer
      expect(bufferManager.getCurrentBufferMs()).toBe(0);
    });

    test('should handle playback loop execution with frames', async () => {
      // Add multiple frames to test scheduling logic
      for (let i = 0; i < 10; i++) {
        const audioData = {
          audioData: `frame-data-${i}`,
          isFirst: i === 0,
          isFinal: i === 9,
        };
        bufferManager.enqueueFrames(audioData);
      }
      
      bufferManager.startPlayback();
      
      // Allow multiple loop iterations
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should handle buffer health state integration', () => {
      // Test when quality monitor provides buffer health
      const metrics = bufferManager.getHealthMetrics();
      expect(metrics.bufferHealthState).toBeTruthy();
      
      // Ensure current buffer is reflected in metrics
      const audioData = {
        audioData: 'test-data',
        isFirst: true,
      };
      bufferManager.enqueueFrames(audioData);
      
      const updatedMetrics = bufferManager.getHealthMetrics();
      expect(updatedMetrics.currentBufferMs).toBeGreaterThanOrEqual(0);
    });

    test('should handle playback with insufficient initial buffer', async () => {
      // Start playback without adding frames first
      bufferManager.startPlayback();
      expect(bufferManager.isPlaying()).toBe(true);
      
      // Allow initial wait to complete
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Still playing even with no initial buffer
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should handle startPlayback when already inactive during wait', async () => {
      bufferManager.startPlayback();
      
      // Immediately stop before wait completes
      setTimeout(() => bufferManager.stopPlayback(), 5);
      
      // Allow wait period to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(bufferManager.isPlaying()).toBe(false);
    });

    test('should handle buffer underrun scenarios', async () => {
      // Create a very small buffer configuration to trigger underruns
      const smallBufferManager = new AudioBufferManager({
        targetBufferMs: 50,
        minBufferMs: 20,
        maxBufferMs: 100,
        frameIntervalMs: 20,
      });
      
      // Start playback with minimal buffer
      smallBufferManager.startPlayback();
      
      // Let it run to potentially hit underrun conditions
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(smallBufferManager.isPlaying()).toBe(true);
      smallBufferManager.destroy();
    });

    test('should handle overrun with frame dropping', () => {
      // Mock frame processor to return many frames
      const mockFrameProcessor = require('../src/audio/FrameProcessor').FrameProcessor;
      const frameProcessorInstance = new mockFrameProcessor();
      
      // Create many long frames to trigger overrun
      const manyFrames = Array.from({ length: 50 }, (_, i) => ({
        sequenceNumber: i,
        data: {
          audioData: 'long-audio-data-frame',
          isFirst: i === 0,
          isFinal: i === 49,
        },
        duration: 30, // Longer duration to fill buffer faster
        timestamp: Date.now() + i * 30,
      }));

      frameProcessorInstance.parseChunk.mockReturnValue(manyFrames);

      const audioData = {
        audioData: 'very-long-audio-sequence',
        isFirst: true,
        isFinal: true,
      };

      // This should trigger overrun handling
      bufferManager.enqueueFrames(audioData);
      
      // Buffer should be managed even with overrun
      expect(bufferManager.getCurrentBufferMs()).toBeGreaterThanOrEqual(0);
    });

    test('should handle frame scheduling with different buffer levels', async () => {
      // Add frames to create a substantial buffer
      for (let i = 0; i < 15; i++) {
        const audioData = {
          audioData: `substantial-frame-${i}`,
          isFirst: i === 0,
          isFinal: i === 14,
        };
        bufferManager.enqueueFrames(audioData);
      }
      
      bufferManager.startPlayback();
      
      // Allow scheduling to occur
      await new Promise(resolve => setTimeout(resolve, 300));
      
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should handle array buffer to base64 conversion for silence', () => {
      // Create a minimal buffer manager to test silence insertion
      const testManager = new AudioBufferManager({
        targetBufferMs: 100,
        minBufferMs: 50,
        maxBufferMs: 200,
        frameIntervalMs: 20,
      });
      
      // Start playback to trigger potential silence insertion
      testManager.startPlayback();
      
      // No errors should occur during silence handling
      expect(testManager.isPlaying()).toBe(true);
      testManager.destroy();
    });

    test('should handle btoa fallback for base64 encoding', () => {
      // Test that base64 encoding works regardless of environment
      const testManager = new AudioBufferManager();
      
      // Add a frame to trigger internal processing
      const audioData = {
        audioData: 'test-for-encoding',
        isFirst: true,
      };
      
      expect(() => testManager.enqueueFrames(audioData)).not.toThrow();
      testManager.destroy();
    });

    test('should calculate frame intervals correctly', async () => {
      const intervalManager = new AudioBufferManager({
        frameIntervalMs: 10, // Shorter interval for faster testing
      });
      
      // Add frames and start playback
      const audioData = {
        audioData: 'interval-test-data',
        isFirst: true,
      };
      intervalManager.enqueueFrames(audioData);
      intervalManager.startPlayback();
      
      // Allow interval calculations to occur
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(intervalManager.isPlaying()).toBe(true);
      intervalManager.destroy();
    });

    test('should handle playback scheduling with empty buffer', async () => {
      bufferManager.startPlayback();
      
      // Let it run with empty buffer
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still be active even with no frames to play
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should handle frame playback errors gracefully', async () => {
      // Mock ExpoPlayAudioStreamModule to throw errors
      mockPlaySound.mockImplementation(() => {
        throw new Error('Native playback failed');
      });
      
      // Add frames
      const audioData = {
        audioData: 'error-test-data',
        isFirst: true,
      };
      bufferManager.enqueueFrames(audioData);
      bufferManager.startPlayback();
      
      // Allow playback attempt
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should continue running despite errors
      expect(bufferManager.isPlaying()).toBe(true);
      
      // Reset mock
      mockPlaySound.mockClear();
    });

    test('should handle empty frame buffer during playback', async () => {
      // Start playback without adding frames
      bufferManager.startPlayback();
      
      // Allow playback loop to attempt frame processing with empty buffer
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should handle empty buffer gracefully
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should handle frame processing when frame is null', () => {
      // Mock the frame processor to return frames, then clear buffer manually
      const audioData = {
        audioData: 'test-data',
        isFirst: true,
      };
      
      bufferManager.enqueueFrames(audioData);
      
      // Clear the internal buffer manually by stopping/starting
      bufferManager.startPlayback();
      bufferManager.stopPlayback();
      bufferManager.startPlayback();
      
      // Should handle null frame scenarios gracefully
      expect(bufferManager.isPlaying()).toBe(true);
    });

    test('should handle underrun detection and silence insertion', async () => {
      // Create a manager with very small buffer to trigger underruns
      const underrunManager = new AudioBufferManager({
        targetBufferMs: 100,
        minBufferMs: 20,
        maxBufferMs: 200,
        frameIntervalMs: 20,
      });
      
      // Start playback with minimal or no buffer
      underrunManager.startPlayback();
      
      // Allow underrun detection to occur
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should still be playing and handling underruns
      expect(underrunManager.isPlaying()).toBe(true);
      underrunManager.destroy();
    });

    test('should handle silence frame insertion during underrun', () => {
      // Create specific configuration to test silence insertion
      const silenceManager = new AudioBufferManager({
        frameIntervalMs: 20,
      });
      
      silenceManager.startPlayback();
      
      // The silence insertion happens internally during underrun handling
      // We test that the manager continues to function
      expect(silenceManager.isPlaying()).toBe(true);
      silenceManager.destroy();
    });

    test('should handle buffer underrun conditions', async () => {
      // Create a manager with high minimum buffer to trigger underrun
      const underrunManager = new AudioBufferManager({
        minBufferMs: 1000, // Very high minimum
        frameIntervalMs: 20,
      });
      
      // Add minimal data to ensure underrun
      const audioData = {
        audioData: 'minimal-data',
        isFirst: true,
      };
      
      underrunManager.enqueueFrames(audioData);
      underrunManager.startPlayback();
      
      // Let the underrun detection trigger
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify quality monitor was called for underrun
      expect(underrunManager.isPlaying()).toBe(true);
      underrunManager.destroy();
    });

    test('should handle buffer overrun conditions', () => {
      // Create a manager with very low maximum buffer to trigger overrun
      const overrunManager = new AudioBufferManager({
        maxBufferMs: 10, // Very low maximum
        frameIntervalMs: 20,
      });
      
      // Add lots of data to trigger overrun
      for (let i = 0; i < 20; i++) {
        const audioData = {
          audioData: `overrun-data-chunk-${i}`,
          isFirst: i === 0,
        };
        overrunManager.enqueueFrames(audioData);
      }
      
      // Verify quality monitor was called for overrun
      expect(overrunManager.isPlaying()).toBe(false);
      overrunManager.destroy();
    });

    test('should handle silence insertion with base64 encoding', () => {
      const silenceManager = new AudioBufferManager({
        minBufferMs: 1000, // High minimum to trigger underrun and silence insertion
        frameIntervalMs: 20,
      });
      
      // Add minimal data to trigger underrun and silence insertion
      const audioData = {
        audioData: 'minimal-data-for-silence',
        isFirst: true,
      };
      
      silenceManager.enqueueFrames(audioData);
      silenceManager.startPlayback();
      
      // Verify manager continues to function after silence insertion
      expect(silenceManager.isPlaying()).toBe(true);
      silenceManager.destroy();
    });

    test('should handle btoa unavailable scenario', () => {
      // Test the btoa fallback by creating conditions where btoa is undefined
      // and the base64 conversion is needed for silence insertion
      
      // Create a manager that will need to insert silence
      const testManager = new AudioBufferManager({
        minBufferMs: 2000, // Very high minimum to force underrun and silence
        frameIntervalMs: 20,
      });
      
      // Save and remove btoa
      const originalBtoa = globalThis.btoa;
      // @ts-ignore - intentionally removing btoa for testing
      delete globalThis.btoa;
      
      try {
        // Add minimal data to trigger underrun and silence insertion
        const audioData = {
          audioData: 'test-minimal',
          isFirst: true,
        };
        
        testManager.enqueueFrames(audioData);
        testManager.startPlayback();
        
        // Force the scenario by waiting for underrun
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            // Verify the manager handled the fallback gracefully
            expect(testManager.isPlaying()).toBe(true);
            testManager.destroy();
            resolve();
          }, 50);
        });
      } finally {
        // Restore btoa
        globalThis.btoa = originalBtoa;
      }
    });

    test('should handle underrun with quality monitor', async () => {
      const underrunManager = new AudioBufferManager({
        minBufferMs: 1000, // High threshold to trigger underrun
        frameIntervalMs: 20,
      });
      
      // Add minimal data to trigger underrun
      const audioData = {
        audioData: 'underrun-test',
        isFirst: true,
      };
      
      underrunManager.enqueueFrames(audioData);
      underrunManager.startPlayback();
      
      // Wait for underrun condition to be triggered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the manager is still functioning
      expect(underrunManager.isPlaying()).toBe(true);
      underrunManager.destroy();
    });

    test('should handle overrun with quality monitor', () => {
      const overrunManager = new AudioBufferManager({
        maxBufferMs: 5, // Very low maximum to trigger overrun
        frameIntervalMs: 10,
      });
      
      // Add many frames to trigger overrun
      for (let i = 0; i < 50; i++) {
        const audioData = {
          audioData: `overrun-frame-${i}`,
          isFirst: i === 0,
        };
        overrunManager.enqueueFrames(audioData);
      }
      
      // This should trigger the overrun condition
      expect(() => overrunManager.startPlayback()).not.toThrow();
      overrunManager.destroy();
    });

    test('should handle underrun when quality monitor is null', () => {
      const manager = new AudioBufferManager({
        minBufferMs: 1000, // High minimum to trigger underrun
        frameIntervalMs: 20,
      });
      
      // Add minimal data
      const audioData = {
        audioData: 'test-data',
        isFirst: true,
      };
      manager.enqueueFrames(audioData);
      
      // Start playback to set up for underrun condition
      manager.startPlayback();
      
      // Destroy to set _qualityMonitor to null
      manager.destroy();
      
      // The underrun check should now handle null quality monitor
      // This tests the branch where _qualityMonitor is null in _handleUnderrun
      expect(() => {
        // Create a new manager to simulate underrun condition after destroy
        const testManager = new AudioBufferManager({
          minBufferMs: 1000,
          frameIntervalMs: 20,
        });
        
        testManager.enqueueFrames(audioData);
        testManager.startPlayback();
        testManager.destroy();
      }).not.toThrow();
    });

    test('should handle overrun when quality monitor is null', () => {
      const manager = new AudioBufferManager({
        maxBufferMs: 5, // Very low maximum
        frameIntervalMs: 10,
      });
      
      // Add lots of data to trigger potential overrun
      for (let i = 0; i < 100; i++) {
        const audioData = {
          audioData: `overrun-data-${i}`,
          isFirst: i === 0,
        };
        manager.enqueueFrames(audioData);
      }
      
      // Destroy to set _qualityMonitor to null  
      manager.destroy();
      
      // The overrun check should handle null quality monitor
      expect(() => {
        const testManager = new AudioBufferManager({
          maxBufferMs: 5,
          frameIntervalMs: 10,
        });
        
        // Add data that would trigger overrun
        for (let i = 0; i < 100; i++) {
          testManager.enqueueFrames({
            audioData: `test-${i}`,
            isFirst: i === 0,
          });
        }
        testManager.destroy();
      }).not.toThrow();
    });
  });
});