/// <reference types="jest" />

// Jest setup file
import '@testing-library/jest-native/extend-expect';

// Mock React Native modules
jest.mock('react-native', () => ({
  NativeModules: {},
  Platform: {
    OS: 'ios',
    select: jest.fn(),
  },
}));

// Mock Expo modules
jest.mock('expo-modules-core', () => ({
  NativeModulesProxy: {},
  EventEmitter: jest.fn(),
  Subscription: jest.fn(),
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