import Foundation
import AVFoundation

// MARK: - Audio Engine State Management (SOLID - Single Responsibility)

enum AudioEngineState {
    case uninitialized
    case initializing
    case ready
    case starting
    case running
    case stopping
    case error(String)
    
    var isOperational: Bool {
        switch self {
        case .ready, .running:
            return true
        default:
            return false
        }
    }
    
    var canStart: Bool {
        switch self {
        case .ready:
            return true
        default:
            return false
        }
    }
    
    var canStop: Bool {
        switch self {
        case .running:
            return true
        default:
            return false
        }
    }
}

// MARK: - State Machine for Audio Engine Lifecycle

class AudioEngineStateMachine {
    private var _state: AudioEngineState = .uninitialized
    private let stateQueue = DispatchQueue(label: "com.expoaudiostream.engineState", attributes: .concurrent)
    
    var currentState: AudioEngineState {
        return stateQueue.sync { _state }
    }
    
    private func setState(_ newState: AudioEngineState) {
        stateQueue.sync(flags: .barrier) {
            Logger.debug("[AudioEngineStateMachine] State transition: \(_state) -> \(newState)")
            _state = newState
        }
    }
    
    // MARK: - State Transitions
    
    func initialize() -> Bool {
        return stateQueue.sync(flags: .barrier) {
            switch _state {
            case .uninitialized, .error:
                _state = .initializing
                return true
            default:
                Logger.debug("[AudioEngineStateMachine] Cannot initialize from state: \(_state)")
                return false
            }
        }
    }
    
    func initializationCompleted(success: Bool) {
        stateQueue.sync(flags: .barrier) {
            switch _state {
            case .initializing:
                _state = success ? .ready : .error("Initialization failed")
            default:
                Logger.debug("[AudioEngineStateMachine] Unexpected initialization completion from state: \(_state)")
            }
        }
    }
    
    func startEngine() -> Bool {
        return stateQueue.sync(flags: .barrier) {
            switch _state {
            case .ready:
                _state = .starting
                return true
            default:
                Logger.debug("[AudioEngineStateMachine] Cannot start engine from state: \(_state)")
                return false
            }
        }
    }
    
    func engineStarted() {
        stateQueue.sync(flags: .barrier) {
            switch _state {
            case .starting:
                _state = .running
            default:
                Logger.debug("[AudioEngineStateMachine] Unexpected engine start from state: \(_state)")
            }
        }
    }
    
    func stopEngine() -> Bool {
        return stateQueue.sync(flags: .barrier) {
            switch _state {
            case .running:
                _state = .stopping
                return true
            default:
                Logger.debug("[AudioEngineStateMachine] Cannot stop engine from state: \(_state)")
                return false
            }
        }
    }
    
    func engineStopped() {
        stateQueue.sync(flags: .barrier) {
            switch _state {
            case .stopping:
                _state = .ready
            default:
                Logger.debug("[AudioEngineStateMachine] Unexpected engine stop from state: \(_state)")
            }
        }
    }
    
    func setError(_ message: String) {
        stateQueue.sync(flags: .barrier) {
            _state = .error(message)
        }
    }
    
    func reset() {
        stateQueue.sync(flags: .barrier) {
            _state = .uninitialized
        }
    }
}

// MARK: - Enhanced Audio Engine Manager with State Machine

class AudioEngineManager {
    private let stateMachine = AudioEngineStateMachine()
    private var audioEngine: AVAudioEngine?
    private let engineQueue = DispatchQueue(label: "com.expoaudiostream.engineManager")
    
    var isRunning: Bool {
        return stateMachine.currentState == .running && audioEngine?.isRunning == true
    }
    
    var canStart: Bool {
        return stateMachine.currentState.canStart
    }
    
    var canStop: Bool {
        return stateMachine.currentState.canStop
    }
    
    // MARK: - Engine Lifecycle Management
    
    func initializeEngine() -> AudioOperationResult<AVAudioEngine> {
        guard stateMachine.initialize() else {
            return .failure(.operationFailed("Cannot initialize engine in current state"))
        }
        
        return engineQueue.sync {
            do {
                let engine = AVAudioEngine()
                self.audioEngine = engine
                self.stateMachine.initializationCompleted(success: true)
                return .success(engine)
            } catch {
                self.stateMachine.initializationCompleted(success: false)
                return .failure(.initializationFailed(error.localizedDescription))
            }
        }
    }
    
    func startEngine() -> AudioOperationResult<Void> {
        guard stateMachine.startEngine() else {
            return .failure(.operationFailed("Cannot start engine in current state"))
        }
        
        return engineQueue.sync {
            guard let engine = audioEngine else {
                stateMachine.setError("No engine available")
                return .failure(.audioSessionManagerUnavailable)
            }
            
            do {
                try engine.start()
                stateMachine.engineStarted()
                return .success(())
            } catch {
                stateMachine.setError("Failed to start engine: \(error.localizedDescription)")
                return .failure(.operationFailed(error.localizedDescription))
            }
        }
    }
    
    func stopEngine() -> AudioOperationResult<Void> {
        guard stateMachine.stopEngine() else {
            return .failure(.operationFailed("Cannot stop engine in current state"))
        }
        
        return engineQueue.sync {
            guard let engine = audioEngine else {
                stateMachine.setError("No engine available")
                return .failure(.audioSessionManagerUnavailable)
            }
            
            engine.stop()
            stateMachine.engineStopped()
            return .success(())
        }
    }
    
    func getEngine() -> AudioOperationResult<AVAudioEngine> {
        guard stateMachine.currentState.isOperational else {
            return .failure(.operationFailed("Engine not operational"))
        }
        
        guard let engine = audioEngine else {
            return .failure(.audioSessionManagerUnavailable)
        }
        
        return .success(engine)
    }
    
    func reset() {
        engineQueue.sync {
            audioEngine?.stop()
            audioEngine = nil
            stateMachine.reset()
        }
    }
}