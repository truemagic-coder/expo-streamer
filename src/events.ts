// packages/expo-audio-stream/src/events.ts

import { EventEmitter, type EventSubscription } from 'expo-modules-core'

import ExpoPlayAudioStreamModule from './ExpoPlayAudioStreamModule'

export interface AudioEventPayload {
    encoded?: string
    buffer?: Float32Array
    fileUri: string
    lastEmittedSize: number
    position: number
    deltaSize: number
    totalSize: number
    mimeType: string
    streamUuid: string
    soundLevel?: number
}

export type SoundChunkPlayedEventPayload = {
    isFinal: boolean
}

export const DeviceReconnectedReasons = {
    newDeviceAvailable: 'newDeviceAvailable',
    oldDeviceUnavailable: 'oldDeviceUnavailable',
    unknown: 'unknown',
} as const

export type DeviceReconnectedReason = (typeof DeviceReconnectedReasons)[keyof typeof DeviceReconnectedReasons]

export type DeviceReconnectedEventPayload = {
    reason: DeviceReconnectedReason
}

// Define the events map for TypeScript
type AudioStreamEventsMap = {
    AudioData: (event: AudioEventPayload) => void;
    SoundChunkPlayed: (event: SoundChunkPlayedEventPayload) => void;
    SoundStarted: (event: unknown) => void;
    DeviceReconnected: (event: DeviceReconnectedEventPayload) => void;
};

const emitter = new EventEmitter<AudioStreamEventsMap>(ExpoPlayAudioStreamModule)

/* istanbul ignore next - event handler is for native module setup */
emitter.addListener('SoundChunkPlayed', () => {})

export const AudioEvents = {
    AudioData: 'AudioData',
    SoundChunkPlayed: 'SoundChunkPlayed',
    SoundStarted: 'SoundStarted',
    DeviceReconnected: 'DeviceReconnected',
}

export function addAudioEventListener(
    listener: (event: AudioEventPayload) => Promise<void>
): EventSubscription {
    return emitter.addListener('AudioData', (event: AudioEventPayload) => {
        // eslint-disable-next-line no-console
        listener(event).catch(console.error);
    })
}

export function addSoundChunkPlayedListener(
    listener: (event: SoundChunkPlayedEventPayload) => Promise<void>
): EventSubscription {
    return emitter.addListener('SoundChunkPlayed', (event: SoundChunkPlayedEventPayload) => {
        // eslint-disable-next-line no-console
        listener(event).catch(console.error);
    })
}

export function subscribeToEvent<T extends unknown>(
    eventName: string,
    listener: (event: T | undefined) => Promise<void>
): EventSubscription {
    // For generic events, we need to cast the eventName to match the expected types
    return emitter.addListener(eventName as keyof AudioStreamEventsMap, (event: unknown) => {
        // eslint-disable-next-line no-console
        listener(event as T).catch(console.error);
    })
}

