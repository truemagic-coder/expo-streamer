import Foundation
import AVFoundation
import ExpoModulesCore

// MARK: - Default Factory Implementation

class DefaultAudioComponentFactory: AudioComponentFactory {
    func createAudioSessionManager() -> AudioSessionManaging {
        return AudioSessionManager()
    }
    
    func createMicrophone() -> MicrophoneManaging {
        return Microphone()
    }
    
    func createSoundPlayer() -> SoundPlayerManaging {
        return SoundPlayer()
    }
}

// MARK: - Thread-Safe Audio Component Manager (SOLID - Single Responsibility)

class AudioComponentManager {
    private let factory: AudioComponentFactory
    private let accessQueue = DispatchQueue(label: "com.expoaudiostream.componentAccess", attributes: .concurrent)
    
    private var _audioSessionManager: AudioSessionManaging?
    private var _microphone: MicrophoneManaging?
    private var _soundPlayer: SoundPlayerManaging?
    
    init(factory: AudioComponentFactory = DefaultAudioComponentFactory()) {
        self.factory = factory
    }
    
    // MARK: - Thread-Safe Component Access
    
    func getAudioSessionManager() -> AudioOperationResult<AudioSessionManaging> {
        return accessQueue.sync {
            if let manager = _audioSessionManager {
                return .success(manager)
            }
            
            let manager = factory.createAudioSessionManager()
            _audioSessionManager = manager
            return .success(manager)
        }
    }
    
    func getMicrophone() -> AudioOperationResult<MicrophoneManaging> {
        return accessQueue.sync {
            if let microphone = _microphone {
                return .success(microphone)
            }
            
            let microphone = factory.createMicrophone()
            _microphone = microphone
            return .success(microphone)
        }
    }
    
    func getSoundPlayer() -> AudioOperationResult<SoundPlayerManaging> {
        return accessQueue.sync {
            if let player = _soundPlayer {
                return .success(player)
            }
            
            let player = factory.createSoundPlayer()
            _soundPlayer = player
            return .success(player)
        }
    }
    
    // MARK: - Safe Cleanup
    
    func cleanup() {
        accessQueue.sync(flags: .barrier) {
            _audioSessionManager = nil
            _microphone = nil
            _soundPlayer = nil
        }
    }
}