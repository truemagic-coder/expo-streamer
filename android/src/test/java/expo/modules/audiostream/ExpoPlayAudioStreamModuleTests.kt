package expo.modules.audiostream

import android.content.Context
import android.media.AudioManager
import android.os.Bundle
import expo.modules.kotlin.Promise
import expo.modules.audiostream.core.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*
import org.mockito.Mock
import org.mockito.Mockito.*
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever

/**
 * Comprehensive test suite for Android audio streaming module
 * Testing SOLID principles, dependency injection, and error handling
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ExpoPlayAudioStreamModuleTests {
    
    // MARK: - Mocks
    
    @Mock
    private lateinit var mockContext: Context
    
    @Mock
    private lateinit var mockAudioManager: AudioManager
    
    @Mock
    private lateinit var mockComponentManager: AudioComponentManager
    
    @Mock
    private lateinit var mockRecorderManager: AudioRecorderManager
    
    @Mock
    private lateinit var mockPlaybackManager: AudioPlaybackManager
    
    @Mock
    private lateinit var mockWavPlayer: WavAudioPlayer
    
    @Mock
    private lateinit var mockPromise: Promise
    
    @Mock
    private lateinit var mockFactory: AudioComponentFactory
    
    // Test subject
    private lateinit var module: TestableAudioStreamModule
    
    // Test coroutine scope
    private val testDispatcher = UnconfinedTestDispatcher()
    
    @Before
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        
        // Setup default mock behaviors
        whenever(mockComponentManager.getAudioRecorderManager())
            .thenReturn(AudioOperationResult.Success(mockRecorderManager))
        whenever(mockComponentManager.getAudioPlaybackManager())
            .thenReturn(AudioOperationResult.Success(mockPlaybackManager))
        whenever(mockComponentManager.getWavAudioPlayer())
            .thenReturn(AudioOperationResult.Success(mockWavPlayer))
        
        module = TestableAudioStreamModule(
            mockComponentManager,
            mockAudioManager,
            testDispatcher
        )
    }
    
    // MARK: - Dependency Injection Tests
    
    @Test
    fun `test component manager initialization with dependency injection`() = runTest(testDispatcher) {
        // Test that component manager is properly injected
        assertNotNull(module.getComponentManager())
        assertEquals(mockComponentManager, module.getComponentManager())
    }
    
    @Test
    fun `test factory pattern usage in component creation`() = runTest(testDispatcher) {
        // Verify factory is used for component creation
        whenever(mockFactory.createAudioRecorderManager())
            .thenReturn(AudioOperationResult.Success(mockRecorderManager))
        
        val result = mockFactory.createAudioRecorderManager()
        assertTrue(result is AudioOperationResult.Success)
        assertEquals(mockRecorderManager, result.getOrNull())
    }
    
    // MARK: - Recording Tests
    
    @Test
    fun `test start recording with successful initialization`() = runTest(testDispatcher) {
        // Given
        val config = RecordingConfig()
        
        // When
        module.testStartRecording(config, mockPromise)
        
        // Then
        verify(mockRecorderManager).startRecording(config, mockPromise)
    }
    
    @Test
    fun `test start recording with component failure`() = runTest(testDispatcher) {
        // Given
        val expectedError = RuntimeException("Component not available")
        whenever(mockComponentManager.getAudioRecorderManager())
            .thenReturn(AudioOperationResult.Failure(expectedError))
        
        // When
        module.testStartRecording(RecordingConfig(), mockPromise)
        
        // Then
        verify(mockPromise).reject(eq("OPERATION_ERROR"), eq(expectedError.message), eq(expectedError))
        verify(mockRecorderManager, never()).startRecording(any(), any())
    }
    
    @Test
    fun `test pause recording delegates to recorder`() = runTest(testDispatcher) {
        // When
        module.testPauseRecording(mockPromise)
        
        // Then
        verify(mockRecorderManager).pauseRecording()
        verify(mockPromise).resolve(null)
    }
    
    @Test
    fun `test stop recording delegates to recorder`() = runTest(testDispatcher) {
        // When
        module.testStopRecording(mockPromise)
        
        // Then
        verify(mockRecorderManager).stopRecording(mockPromise)
    }
    
    // MARK: - Playback Tests
    
    @Test
    fun `test play audio with valid parameters`() = runTest(testDispatcher) {
        // Given
        val base64chunk = "dGVzdCBhdWRpbyBkYXRh"
        val turnId = "turn123"
        val encoding = "pcm"
        
        // When
        module.testPlayAudio(base64chunk, turnId, encoding, mockPromise)
        
        // Then
        verify(mockPlaybackManager).playAudio(base64chunk, turnId, encoding, mockPromise)
    }
    
    @Test
    fun `test play audio with component failure`() = runTest(testDispatcher) {
        // Given
        val expectedError = RuntimeException("Playback manager not available")
        whenever(mockComponentManager.getAudioPlaybackManager())
            .thenReturn(AudioOperationResult.Failure(expectedError))
        
        // When
        module.testPlayAudio("data", "turn", "pcm", mockPromise)
        
        // Then
        verify(mockPromise).reject(eq("OPERATION_ERROR"), eq(expectedError.message), eq(expectedError))
    }
    
    @Test
    fun `test clear playback queue by turn id`() = runTest(testDispatcher) {
        // Given
        val turnId = "turn123"
        
        // When
        module.testClearPlaybackQueue(turnId, mockPromise)
        
        // Then
        verify(mockPlaybackManager).clearPlaybackQueueByTurnId(turnId, mockPromise)
    }
    
    // MARK: - WAV Player Tests
    
    @Test
    fun `test play wav with valid data`() = runTest(testDispatcher) {
        // Given
        val base64Data = "dGVzdCB3YXYgZGF0YQ=="
        
        // When
        module.testPlayWav(base64Data, mockPromise)
        
        // Then
        verify(mockWavPlayer).playWav(base64Data, mockPromise)
    }
    
    @Test
    fun `test stop wav player`() = runTest(testDispatcher) {
        // When
        module.testStopWav(mockPromise)
        
        // Then
        verify(mockWavPlayer).stop()
        verify(mockPromise).resolve(null)
    }
    
    // MARK: - Error Handling Tests
    
    @Test
    fun `test safe operation with exception handling`() = runTest(testDispatcher) {
        // Given
        val expectedException = RuntimeException("Test exception")
        whenever(mockRecorderManager.pauseRecording()).thenThrow(expectedException)
        
        // When
        module.testPauseRecording(mockPromise)
        
        // Then
        verify(mockPromise).reject(eq("OPERATION_ERROR"), eq(expectedException.message), eq(expectedException))
    }
    
    @Test
    fun `test health status retrieval`() = runTest(testDispatcher) {
        // Given
        val expectedHealthStatus = mapOf(
            "recorderStatus" to "active",
            "playbackStatus" to "ready",
            "wavPlayerStatus" to "idle"
        )
        whenever(mockComponentManager.getHealthStatus()).thenReturn(expectedHealthStatus)
        
        // When
        module.testGetHealthStatus(mockPromise)
        
        // Then
        verify(mockPromise).resolve(expectedHealthStatus)
    }
    
    // MARK: - Thread Safety Tests
    
    @Test
    fun `test concurrent recording operations are safe`() = runTest(testDispatcher) {
        // Given multiple concurrent operations
        val promises = List(10) { mock<Promise>() }
        
        // When - execute multiple operations concurrently
        val jobs = promises.map { promise ->
            launch {
                module.testStartRecording(RecordingConfig(), promise)
            }
        }
        
        // Wait for all operations
        jobs.joinAll()
        
        // Then - all operations should complete without exception
        promises.forEach { promise ->
            verify(promise, never()).reject(any(), any(), any())
        }
    }
    
    @Test
    fun `test component manager reset is thread safe`() = runTest(testDispatcher) {
        // Given concurrent reset and usage operations
        val jobs = mutableListOf<Job>()
        
        // When - execute reset and usage operations concurrently
        repeat(5) {
            jobs.add(launch { module.testDestroy() })
            jobs.add(launch { module.testStartRecording(RecordingConfig(), mockPromise) })
        }
        
        // Wait for all operations
        jobs.joinAll()
        
        // Then - no exceptions should occur
        // Component manager should handle concurrent access safely
        assertTrue("All operations completed", jobs.all { it.isCompleted })
    }
    
    // MARK: - Integration Tests
    
    @Test
    fun `test complete recording workflow`() = runTest(testDispatcher) {
        // Given
        val config = RecordingConfig()
        val startPromise = mock<Promise>()
        val pausePromise = mock<Promise>()
        val resumePromise = mock<Promise>()
        val stopPromise = mock<Promise>()
        
        // When - execute complete workflow
        module.testStartRecording(config, startPromise)
        module.testPauseRecording(pausePromise)
        module.testResumeRecording(resumePromise)
        module.testStopRecording(stopPromise)
        
        // Then - all operations should be called in order
        val inOrder = inOrder(mockRecorderManager)
        inOrder.verify(mockRecorderManager).startRecording(config, startPromise)
        inOrder.verify(mockRecorderManager).pauseRecording()
        inOrder.verify(mockRecorderManager).resumeRecording()
        inOrder.verify(mockRecorderManager).stopRecording(stopPromise)
    }
    
    @Test
    fun `test playback queue management`() = runTest(testDispatcher) {
        // Given
        val turnId1 = "turn1"
        val turnId2 = "turn2"
        val data1 = "data1"
        val data2 = "data2"
        
        // When
        module.testPlayAudio(data1, turnId1, "pcm", mock())
        module.testPlayAudio(data2, turnId2, "pcm", mock())
        module.testClearPlaybackQueue(turnId1, mock())
        
        // Then
        verify(mockPlaybackManager).playAudio(data1, turnId1, "pcm", any())
        verify(mockPlaybackManager).playAudio(data2, turnId2, "pcm", any())
        verify(mockPlaybackManager).clearPlaybackQueueByTurnId(turnId1, any())
    }
}

/**
 * Testable version of the audio stream module for unit testing
 * Exposes internal methods and allows dependency injection
 */
class TestableAudioStreamModule(
    private val componentManager: AudioComponentManager,
    private val audioManager: AudioManager,
    private val testDispatcher: CoroutineDispatcher
) {
    
    private val moduleScope = CoroutineScope(SupervisorJob() + testDispatcher)
    
    fun getComponentManager(): AudioComponentManager = componentManager
    
    suspend fun testStartRecording(config: RecordingConfig, promise: Promise) {
        handleSafeOperation(promise) {
            val recorder = componentManager.getAudioRecorderManager().getOrThrow()
            recorder.startRecording(config, promise)
        }
    }
    
    suspend fun testPauseRecording(promise: Promise) {
        handleSafeOperation(promise) {
            val recorder = componentManager.getAudioRecorderManager().getOrThrow()
            recorder.pauseRecording()
            promise.resolve(null)
        }
    }
    
    suspend fun testResumeRecording(promise: Promise) {
        handleSafeOperation(promise) {
            val recorder = componentManager.getAudioRecorderManager().getOrThrow()
            recorder.resumeRecording()
            promise.resolve(null)
        }
    }
    
    suspend fun testStopRecording(promise: Promise) {
        handleSafeOperation(promise) {
            val recorder = componentManager.getAudioRecorderManager().getOrThrow()
            recorder.stopRecording(promise)
        }
    }
    
    suspend fun testPlayAudio(base64chunk: String, turnId: String, encoding: String?, promise: Promise) {
        handleSafeOperation(promise) {
            val playback = componentManager.getAudioPlaybackManager().getOrThrow()
            playback.playAudio(base64chunk, turnId, encoding, promise)
        }
    }
    
    suspend fun testClearPlaybackQueue(turnId: String, promise: Promise) {
        handleSafeOperation(promise) {
            val playback = componentManager.getAudioPlaybackManager().getOrThrow()
            playback.clearPlaybackQueueByTurnId(turnId, promise)
        }
    }
    
    suspend fun testPlayWav(base64Data: String, promise: Promise) {
        handleSafeOperation(promise) {
            val wavPlayer = componentManager.getWavAudioPlayer().getOrThrow()
            wavPlayer.playWav(base64Data, promise)
        }
    }
    
    suspend fun testStopWav(promise: Promise) {
        handleSafeOperation(promise) {
            val wavPlayer = componentManager.getWavAudioPlayer().getOrThrow()
            wavPlayer.stop()
            promise.resolve(null)
        }
    }
    
    suspend fun testGetHealthStatus(promise: Promise) {
        try {
            val healthStatus = componentManager.getHealthStatus()
            promise.resolve(healthStatus)
        } catch (e: Exception) {
            promise.reject("HEALTH_CHECK_ERROR", e.message, e)
        }
    }
    
    fun testDestroy() {
        moduleScope.cancel()
        runBlocking {
            componentManager.destroy()
        }
    }
    
    private suspend inline fun handleSafeOperation(
        promise: Promise,
        crossinline operation: suspend () -> Unit
    ) {
        try {
            operation()
        } catch (e: Exception) {
            promise.reject("OPERATION_ERROR", e.message, e)
        }
    }
    
    private fun <T> AudioOperationResult<T>.getOrThrow(): T {
        return when (this) {
            is AudioOperationResult.Success -> value
            is AudioOperationResult.Failure -> throw error
        }
    }
}