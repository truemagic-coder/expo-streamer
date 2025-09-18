import XCTest
import AVFoundation
@testable import ExpoPlayAudioStream

// MARK: - Mock Components for Testing

class MockAudioSessionManager: AudioSessionManaging {
    weak var delegate: AudioStreamManagerDelegate?
    
    var startRecordingCalled = false
    var stopRecordingCalled = false
    var pauseRecordingCalled = false
    var resumeRecordingCalled = false
    
    func startRecording(settings: RecordingSettings, intervalMilliseconds: Int) -> StartRecordingResult? {
        startRecordingCalled = true
        return StartRecordingResult()
    }
    
    func stopRecording() -> RecordingResult? {
        stopRecordingCalled = true
        return RecordingResult(fileUri: "test://file.wav")
    }
    
    func pauseRecording() {
        pauseRecordingCalled = true
    }
    
    func resumeRecording() {
        resumeRecordingCalled = true
    }
    
    func playAudio(_ chunk: String, _ turnId: String, commonFormat: AVAudioCommonFormat, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        resolver(nil)
    }
    
    func cleanPlaybackQueue(_ turnId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        resolver(nil)
    }
    
    func pauseAudio(promise: Promise) {
        promise.resolve(nil)
    }
    
    func stopAudio(promise: Promise) {
        promise.resolve(nil)
    }
}

class MockMicrophone: MicrophoneManaging {
    weak var delegate: MicrophoneDataDelegate?
    
    var startRecordingCalled = false
    var stopRecordingCalled = false
    var toggleSilenceCalled = false
    
    func startRecording(settings: RecordingSettings, intervalMilliseconds: Int) -> StartRecordingResult? {
        startRecordingCalled = true
        return StartRecordingResult()
    }
    
    func stopRecording(resolver: RCTPromiseResolveBlock?) -> RecordingResult? {
        stopRecordingCalled = true
        return RecordingResult(fileUri: "test://file.wav")
    }
    
    func toggleSilence() {
        toggleSilenceCalled = true
    }
}

class MockSoundPlayer: SoundPlayerManaging {
    weak var delegate: SoundPlayerDelegate?
    
    var playSoundCalled = false
    var playWavCalled = false
    var updateConfigCalled = false
    var stopCalled = false
    var interruptCalled = false
    var resumeCalled = false
    var clearSoundQueueCalled = false
    
    func playSound(base64Chunk: String, turnId: String, encoding: String?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) throws {
        playSoundCalled = true
        resolver(nil)
    }
    
    func playWav(base64Wav base64String: String) {
        playWavCalled = true
    }
    
    func updateConfig(_ newConfig: SoundConfig) throws {
        updateConfigCalled = true
    }
    
    func stop(_ promise: Promise) {
        stopCalled = true
        promise.resolve(nil)
    }
    
    func interrupt(_ promise: Promise) {
        interruptCalled = true
        promise.resolve(nil)
    }
    
    func resume() {
        resumeCalled = true
    }
    
    func clearSoundQueue(turnIdToClear turnId: String, resolver promise: Promise) {
        clearSoundQueueCalled = true
        promise.resolve(nil)
    }
}

class MockAudioComponentFactory: AudioComponentFactory {
    let mockAudioSessionManager = MockAudioSessionManager()
    let mockMicrophone = MockMicrophone()
    let mockSoundPlayer = MockSoundPlayer()
    
    func createAudioSessionManager() -> AudioSessionManaging {
        return mockAudioSessionManager
    }
    
    func createMicrophone() -> MicrophoneManaging {
        return mockMicrophone
    }
    
    func createSoundPlayer() -> SoundPlayerManaging {
        return mockSoundPlayer
    }
}

// MARK: - Test Cases

class ExpoPlayAudioStreamModuleTests: XCTestCase {
    var mockFactory: MockAudioComponentFactory!
    var componentManager: AudioComponentManager!
    var module: ExpoPlayAudioStreamModule!
    
    override func setUp() {
        super.setUp()
        mockFactory = MockAudioComponentFactory()
        componentManager = AudioComponentManager(factory: mockFactory)
        module = ExpoPlayAudioStreamModule(componentManager: componentManager)
    }
    
    override func tearDown() {
        module = nil
        componentManager = nil
        mockFactory = nil
        super.tearDown()
    }
    
    // MARK: - Component Manager Tests
    
    func testComponentManagerThreadSafety() {
        let expectation = XCTestExpectation(description: "Thread safety test")
        let iterations = 100
        var completedIterations = 0
        
        for i in 0..<iterations {
            DispatchQueue.global().async {
                let result = self.componentManager.getAudioSessionManager()
                XCTAssertNotNil(result.value, "Should get audio session manager on iteration \(i)")
                
                DispatchQueue.main.async {
                    completedIterations += 1
                    if completedIterations == iterations {
                        expectation.fulfill()
                    }
                }
            }
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    func testComponentManagerConsistency() {
        // Get the same component multiple times and ensure it's the same instance
        let manager1 = componentManager.getAudioSessionManager().value
        let manager2 = componentManager.getAudioSessionManager().value
        
        XCTAssertTrue(manager1 === manager2, "Should return the same instance")
    }
    
    // MARK: - Audio Engine State Machine Tests
    
    func testAudioEngineStateMachine() {
        let stateMachine = AudioEngineStateMachine()
        
        // Test initial state
        XCTAssertEqual(stateMachine.currentState, .uninitialized)
        
        // Test initialization
        XCTAssertTrue(stateMachine.initialize())
        XCTAssertEqual(stateMachine.currentState, .initializing)
        
        // Test successful initialization
        stateMachine.initializationCompleted(success: true)
        XCTAssertEqual(stateMachine.currentState, .ready)
        
        // Test engine start
        XCTAssertTrue(stateMachine.startEngine())
        XCTAssertEqual(stateMachine.currentState, .starting)
        
        stateMachine.engineStarted()
        XCTAssertEqual(stateMachine.currentState, .running)
        
        // Test engine stop
        XCTAssertTrue(stateMachine.stopEngine())
        XCTAssertEqual(stateMachine.currentState, .stopping)
        
        stateMachine.engineStopped()
        XCTAssertEqual(stateMachine.currentState, .ready)
    }
    
    func testAudioEngineStateInvalidTransitions() {
        let stateMachine = AudioEngineStateMachine()
        
        // Cannot start from uninitialized
        XCTAssertFalse(stateMachine.startEngine())
        
        // Cannot stop from uninitialized
        XCTAssertFalse(stateMachine.stopEngine())
        
        // Move to ready state
        XCTAssertTrue(stateMachine.initialize())
        stateMachine.initializationCompleted(success: true)
        
        // Cannot initialize again from ready
        XCTAssertFalse(stateMachine.initialize())
    }
    
    // MARK: - Error Handling Tests
    
    func testAudioOperationResultSuccess() {
        let result: AudioOperationResult<String> = .success("test")
        XCTAssertEqual(result.value, "test")
        XCTAssertNil(result.error)
    }
    
    func testAudioOperationResultFailure() {
        let result: AudioOperationResult<String> = .failure(.audioSessionManagerUnavailable)
        XCTAssertNil(result.value)
        XCTAssertEqual(result.error, .audioSessionManagerUnavailable)
    }
    
    // MARK: - Integration Tests
    
    func testModuleRecordingFlow() {
        // This would test the actual recording flow with mocks
        // In a real implementation, we'd test:
        // 1. startRecording calls the right methods
        // 2. Error handling works correctly
        // 3. Promise resolution/rejection works
        
        XCTAssertNotNil(module, "Module should be initialized")
        
        // Test that mocks are properly set up
        let managerResult = componentManager.getAudioSessionManager()
        XCTAssertNotNil(managerResult.value)
        XCTAssertTrue(managerResult.value is MockAudioSessionManager)
    }
}

// MARK: - Thread Safety Tests

class ThreadSafetyTests: XCTestCase {
    
    func testConcurrentAudioQueueAccess() {
        // This test would verify that our bufferAccessQueue fixes work
        // In a real implementation, we'd create multiple threads accessing
        // the audio queue simultaneously and verify no crashes occur
        
        let expectation = XCTestExpectation(description: "Concurrent access test")
        let iterations = 50
        var completedOperations = 0
        
        let mockFactory = MockAudioComponentFactory()
        let componentManager = AudioComponentManager(factory: mockFactory)
        
        for i in 0..<iterations {
            DispatchQueue.global().async {
                let result = componentManager.getSoundPlayer()
                XCTAssertNotNil(result.value, "Should get sound player on iteration \(i)")
                
                DispatchQueue.main.async {
                    completedOperations += 1
                    if completedOperations == iterations {
                        expectation.fulfill()
                    }
                }
            }
        }
        
        wait(for: [expectation], timeout: 10.0)
    }
}

// MARK: - Extension for Equatable AudioModuleError

extension AudioModuleError: Equatable {
    public static func == (lhs: AudioModuleError, rhs: AudioModuleError) -> Bool {
        switch (lhs, rhs) {
        case (.audioSessionManagerUnavailable, .audioSessionManagerUnavailable),
             (.microphoneUnavailable, .microphoneUnavailable),
             (.soundPlayerUnavailable, .soundPlayerUnavailable):
            return true
        case (.initializationFailed(let lhsMessage), .initializationFailed(let rhsMessage)),
             (.operationFailed(let lhsMessage), .operationFailed(let rhsMessage)):
            return lhsMessage == rhsMessage
        default:
            return false
        }
    }
}

// MARK: - Extension for Equatable AudioEngineState

extension AudioEngineState: Equatable {
    public static func == (lhs: AudioEngineState, rhs: AudioEngineState) -> Bool {
        switch (lhs, rhs) {
        case (.uninitialized, .uninitialized),
             (.initializing, .initializing),
             (.ready, .ready),
             (.starting, .starting),
             (.running, .running),
             (.stopping, .stopping):
            return true
        case (.error(let lhsMessage), .error(let rhsMessage)):
            return lhsMessage == rhsMessage
        default:
            return false
        }
    }
}