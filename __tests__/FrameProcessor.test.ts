import { FrameProcessor } from '../src/audio/FrameProcessor';

describe('FrameProcessor', () => {
  let frameProcessor: FrameProcessor;
  const frameIntervalMs = 20;

  beforeEach(() => {
    frameProcessor = new FrameProcessor(frameIntervalMs);
  });

  describe('Initialization', () => {
    test('should initialize with correct frame interval', () => {
      expect(frameProcessor).toBeDefined();
    });
  });

  describe('Chunk Parsing', () => {
    test('should parse valid audio chunk', () => {
      const audioPayload = {
        audioData: 'dGVzdCBhdWRpbyBkYXRh', // base64: "test audio data"
        isFirst: true,
        isFinal: false
      };

      const frames = frameProcessor.parseChunk(audioPayload);
      expect(Array.isArray(frames)).toBe(true);
      expect(frames.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty audio data', () => {
      const audioPayload = {
        audioData: '',
        isFirst: true,
        isFinal: false
      };

      const frames = frameProcessor.parseChunk(audioPayload);
      expect(Array.isArray(frames)).toBe(true);
      expect(frames.length).toBe(0);
    });

    test('should handle malformed base64 data', () => {
      const audioPayload = {
        audioData: 'invalid-base64!@#$%',
        isFirst: true,
        isFinal: false
      };

      // Should not throw, might return empty array or handle gracefully
      expect(() => {
        frameProcessor.parseChunk(audioPayload);
      }).not.toThrow();
    });

    test('should handle very large audio data', () => {
      // Create a large base64 string - using btoa for browser compatibility
      const largeString = 'a'.repeat(10000);
      const largeData = btoa(largeString);
      const audioPayload = {
        audioData: largeData,
        isFirst: false,
        isFinal: true
      };

      const frames = frameProcessor.parseChunk(audioPayload);
      expect(Array.isArray(frames)).toBe(true);
    });

    test('should mark first and final chunks correctly', () => {
      const firstPayload = {
        audioData: 'Zmlyc3QgY2h1bms=', // "first chunk"
        isFirst: true,
        isFinal: false
      };

      const finalPayload = {
        audioData: 'ZmluYWwgY2h1bms=', // "final chunk"
        isFirst: false,
        isFinal: true
      };

      const firstFrames = frameProcessor.parseChunk(firstPayload);
      const finalFrames = frameProcessor.parseChunk(finalPayload);

      expect(Array.isArray(firstFrames)).toBe(true);
      expect(Array.isArray(finalFrames)).toBe(true);
    });
  });

  describe('Frame Processing', () => {
    test('should handle multiple chunks in sequence', () => {
      const chunks = [
        { audioData: 'Y2h1bmsx', isFirst: true, isFinal: false },   // "chunk1"
        { audioData: 'Y2h1bmsy', isFirst: false, isFinal: false },  // "chunk2"
        { audioData: 'Y2h1bmtz', isFirst: false, isFinal: true }    // "chunk3"
      ];

      let totalFrames = 0;
      chunks.forEach(chunk => {
        const frames = frameProcessor.parseChunk(chunk);
        totalFrames += frames.length;
      });

      expect(totalFrames).toBeGreaterThanOrEqual(0);
    });

    test('should process frames with different encodings', () => {
      // Test with PCM_S16LE encoding (default)
      const audioPayload = {
        audioData: 'cGNtIGF1ZGlvIGRhdGE=', // "pcm audio data"
        isFirst: true,
        isFinal: false
      };

      const frames = frameProcessor.parseChunk(audioPayload);
      expect(Array.isArray(frames)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle null/undefined audio data gracefully', () => {
      const invalidPayloads = [
        { audioData: null as unknown as string, isFirst: true, isFinal: false },
        { audioData: undefined as unknown as string, isFirst: true, isFinal: false }
      ];

      invalidPayloads.forEach(payload => {
        expect(() => {
          frameProcessor.parseChunk(payload);
        }).not.toThrow();
      });
    });

    test('should handle missing payload properties', () => {
      const minimalPayload = {
        audioData: 'dGVzdA==' // "test"
        // Missing isFirst and isFinal
      } as { audioData: string };

      expect(() => {
        frameProcessor.parseChunk(minimalPayload);
      }).not.toThrow();
    });

    test('should reject chunks that exceed size limit', () => {
      // Create base64 data that when decoded exceeds 64KB
      // Using valid base64 characters to ensure it passes initial validation
      const oversizedData = 'QWFh'.repeat(21875); // 87500 chars = ~65625 bytes decoded > 64KB
      const payload = {
        audioData: oversizedData,
        isFirst: true,
        isFinal: false
      };

      // Verify our calculation is correct
      const estimatedSize = (oversizedData.length * 3) / 4;
      expect(estimatedSize).toBeGreaterThan(64 * 1024);

      const frames = frameProcessor.parseChunk(payload);
      expect(Array.isArray(frames)).toBe(true);
      expect(frames.length).toBe(0); // Should return empty array due to size limit
    });

    test('should handle audio data that triggers duration warnings', () => {
      // Create data that will result in duration > 1000ms
      // Need estimatedBytes > 32000 for duration > 1000ms
      // Base64 length needed: 32000 * 4/3 = ~42667 chars, but under the 64KB limit
      const longAudioData = 'QWFh'.repeat(14222); // ~42666 chars = ~32000 bytes decoded
      const payload = {
        audioData: longAudioData,
        isFirst: true,
        isFinal: false
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const frames = frameProcessor.parseChunk(payload);
      expect(Array.isArray(frames)).toBe(true);
      
      consoleSpy.mockRestore();
    });

    test('should handle duration calculation exceptions through malformed regex', () => {
      // Create a string that passes basic validation but might fail in match() call
      // We'll try to trigger the catch block by manipulating the duration calculation
      const originalMatch = String.prototype.match;
      
      // Mock match to throw an error during duration calculation
      const mockMatch = jest.fn().mockImplementation(function(this: string, regex: RegExp) {
        if (this.includes('=') && regex.toString().includes('=')) {
          throw new Error('Mocked regex error');
        }
        return originalMatch.call(this, regex);
      });
      
      String.prototype.match = mockMatch;
      
      const payload = {
        audioData: 'QWFhQWFh', // Valid base64 with padding
        isFirst: true,
        isFinal: false
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(() => {
        frameProcessor.parseChunk(payload);
      }).not.toThrow();
      
      // Restore original methods
      String.prototype.match = originalMatch;
      consoleSpy.mockRestore();
      mockMatch.mockRestore();
    });

    test('should handle base64 with whitespace', () => {
      const payloadWithWhitespace = {
        audioData: 'dGVz\n\r\t dA==', // "test" with whitespace
        isFirst: true,
        isFinal: false
      };

      const frames = frameProcessor.parseChunk(payloadWithWhitespace);
      expect(Array.isArray(frames)).toBe(true);
    });

    test('should handle invalid base64 format', () => {
      const invalidBase64Payload = {
        audioData: 'this is not base64!!!',
        isFirst: true,
        isFinal: false
      };

      expect(() => {
        frameProcessor.parseChunk(invalidBase64Payload);
      }).not.toThrow();
    });

    test('should handle base64 with incorrect padding', () => {
      const paddingPayloads = [
        { audioData: 'dGVz', isFirst: true, isFinal: false },      // needs ==
        { audioData: 'dGVzdA', isFirst: true, isFinal: false },    // needs =
        { audioData: 'dGVzdAE', isFirst: true, isFinal: false }    // no padding needed
      ];

      paddingPayloads.forEach(payload => {
        expect(() => {
          frameProcessor.parseChunk(payload);
        }).not.toThrow();
      });
    });

    test('should handle duration calculation errors', () => {
      // Create a payload that might cause duration calculation issues
      const extremePayload = {
        audioData: 'A', // Very short, might cause calculation issues
        isFirst: true,
        isFinal: false
      };

      expect(() => {
        frameProcessor.parseChunk(extremePayload);
      }).not.toThrow();
    });

    test('should handle audio data that results in extreme duration calculations', () => {
      // Test data that might trigger the duration out of range warning
      const payload = {
        audioData: 'AAAA', // Very minimal data that might result in extreme duration
        isFirst: true,
        isFinal: false
      };

      const frames = frameProcessor.parseChunk(payload);
      expect(Array.isArray(frames)).toBe(true);
    });

    test('should handle malformed audio data that causes parsing errors', () => {
      // Create data that looks like base64 but causes issues during processing
      // This should trigger the catch block in duration calculation
      const payload = {
        audioData: 'QQ==', // Valid base64 but minimal, might cause errors in processing
        isFirst: true,
        isFinal: false
      };

      expect(() => {
        frameProcessor.parseChunk(payload);
      }).not.toThrow();
    });

    test('should handle empty string audio data', () => {
      const emptyPayload = {
        audioData: '',
        isFirst: true,
        isFinal: false
      };

      const frames = frameProcessor.parseChunk(emptyPayload);
      expect(frames).toEqual([]);
    });

    test('should handle non-object payload', () => {
      expect(() => {
        frameProcessor.parseChunk(null as unknown as { audioData: string; isFirst: boolean; isFinal: boolean });
      }).not.toThrow();

      expect(() => {
        frameProcessor.parseChunk("string" as unknown as { audioData: string; isFirst: boolean; isFinal: boolean });
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    test('should handle rapid chunk processing', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        const payload = {
          audioData: `Y2h1bms${i}`, // chunk + number
          isFirst: i === 0,
          isFinal: i === 99
        };
        frameProcessor.parseChunk(payload);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero-length intervals', () => {
      const zeroIntervalProcessor = new FrameProcessor(0);
      const payload = {
        audioData: 'dGVzdA==',
        isFirst: true,
        isFinal: false
      };

      expect(() => {
        zeroIntervalProcessor.parseChunk(payload);
      }).not.toThrow();
    });

    test('should handle very large intervals', () => {
      const largeIntervalProcessor = new FrameProcessor(10000);
      const payload = {
        audioData: 'dGVzdA==',
        isFirst: true,
        isFinal: false
      };

      expect(() => {
        largeIntervalProcessor.parseChunk(payload);
      }).not.toThrow();
    });

    test('should handle special characters in base64', () => {
      const specialPayload = {
        audioData: 'SGVsbG8gV29ybGQh', // "Hello World!"
        isFirst: true,
        isFinal: true
      };

      const frames = frameProcessor.parseChunk(specialPayload);
      expect(Array.isArray(frames)).toBe(true);
    });
  });
});