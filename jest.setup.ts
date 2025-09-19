/// <reference types="jest" />
declare var global: any;

// Jest setup file
// Note: @testing-library/jest-native is deprecated. 
// Built-in Jest matchers from @testing-library/react-native are automatically
// available when importing from @testing-library/react-native, but since we're
// testing pure TypeScript classes, we only need standard Jest matchers.

// Mock React Native modules
jest.mock('react-native', () => ({
  NativeModules: {},
  Platform: {
    OS: 'ios',
    select: jest.fn((config: any) => config.ios || config.default),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 667 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  StyleSheet: {
    create: jest.fn((styles) => styles),
  },
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock Expo modules
jest.mock('expo-modules-core', () => ({
  NativeModulesProxy: {},
  EventEmitter: jest.fn(),
  Subscription: jest.fn(),
  requireNativeModule: jest.fn(() => ({
    // Mock native module methods
    startAudioStream: jest.fn(),
    stopAudioStream: jest.fn(),
    pauseAudioStream: jest.fn(),
    resumeAudioStream: jest.fn(),
    adjustVolume: jest.fn(),
    getAudioLevel: jest.fn(() => 0),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
}));

// Global test configuration
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};