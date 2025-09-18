import Foundation
import AVFoundation
import ExpoModulesCore

// MARK: - Core Protocols for Dependency Injection (SOLID - Dependency Inversion Principle)

/// Protocol for audio session management operations
protocol AudioSessionManaging: AnyObject {
    var delegate: AudioStreamManagerDelegate? { get set }
    
    func startRecording(settings: RecordingSettings, intervalMilliseconds: Int) -> StartRecordingResult?
    func stopRecording() -> RecordingResult?
    func pauseRecording()
    func resumeRecording()
    func playAudio(_ chunk: String, _ turnId: String, commonFormat: AVAudioCommonFormat, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock)
    func cleanPlaybackQueue(_ turnId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock)
    func pauseAudio(promise: Promise)
    func stopAudio(promise: Promise)
}

/// Protocol for microphone operations
protocol MicrophoneManaging: AnyObject {
    var delegate: MicrophoneDataDelegate? { get set }
    
    func startRecording(settings: RecordingSettings, intervalMilliseconds: Int) -> StartRecordingResult?
    func stopRecording(resolver: RCTPromiseResolveBlock?) -> RecordingResult?
    func toggleSilence()
}

/// Protocol for sound player operations
protocol SoundPlayerManaging: AnyObject {
    var delegate: SoundPlayerDelegate? { get set }
    
    func playSound(base64Chunk: String, turnId: String, encoding: String?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) throws
    func playWav(base64Wav base64String: String)
    func updateConfig(_ newConfig: SoundConfig) throws
    func stop(_ promise: Promise)
    func interrupt(_ promise: Promise)
    func resume()
    func clearSoundQueue(turnIdToClear turnId: String, resolver promise: Promise)
}

// MARK: - Factory Protocol for Creating Audio Components

/// Factory for creating audio management components (SOLID - Single Responsibility + Dependency Inversion)
protocol AudioComponentFactory {
    func createAudioSessionManager() -> AudioSessionManaging
    func createMicrophone() -> MicrophoneManaging
    func createSoundPlayer() -> SoundPlayerManaging
}

// MARK: - Error Handling Types

enum AudioModuleError: Error, LocalizedError {
    case audioSessionManagerUnavailable
    case microphoneUnavailable
    case soundPlayerUnavailable
    case initializationFailed(String)
    case operationFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .audioSessionManagerUnavailable:
            return "Audio session manager is not available"
        case .microphoneUnavailable:
            return "Microphone is not available"
        case .soundPlayerUnavailable:
            return "Sound player is not available"
        case .initializationFailed(let message):
            return "Initialization failed: \(message)"
        case .operationFailed(let message):
            return "Operation failed: \(message)"
        }
    }
}

// MARK: - Result Types for Safe Operations

enum AudioOperationResult<T> {
    case success(T)
    case failure(AudioModuleError)
    
    var value: T? {
        if case .success(let value) = self {
            return value
        }
        return nil
    }
    
    var error: AudioModuleError? {
        if case .failure(let error) = self {
            return error
        }
        return nil
    }
}