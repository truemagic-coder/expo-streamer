package expo.modules.audiostream.core

import expo.modules.kotlin.Promise
import android.os.Bundle

/**
 * SOLID Principles Implementation for Android Audio Stream
 * 
 * Core interfaces defining contracts for audio components
 * Following Dependency Inversion Principle - depend on abstractions, not concretions
 */

// MARK: - Core Audio Component Interfaces

/**
 * Interface for audio recording operations (Interface Segregation Principle)
 */
interface AudioRecorderManaging {
    fun startRecording(config: RecordingConfig, promise: Promise)
    fun stopRecording(promise: Promise)
    fun pauseRecording()
    fun resumeRecording()
    fun toggleSilence()
    fun isRecording(): Boolean
    fun destroy()
}

/**
 * Interface for audio playback operations (Interface Segregation Principle)
 */
interface AudioPlaybackManaging {
    fun playAudio(base64chunk: String, turnId: String, encoding: String?, promise: Promise)
    fun clearPlaybackQueueByTurnId(turnId: String, promise: Promise)
    fun pausePlayback(promise: Promise?)
    fun stopPlayback(promise: Promise?)
    fun isPlaying(): Boolean
    fun destroy()
}

/**
 * Interface for WAV audio player operations (Interface Segregation Principle)
 */
interface WavAudioPlayerManaging {
    fun playWav(base64Data: String, promise: Promise)
    fun stop()
    fun destroy()
}

/**
 * Interface for audio effects management (Interface Segregation Principle)
 */
interface AudioEffectsManaging {
    fun enableEffects()
    fun disableEffects()
    fun isEffectsEnabled(): Boolean
    fun destroy()
}

/**
 * Interface for event sending operations (Interface Segregation Principle)
 */
interface EventSenderManaging {
    fun sendExpoEvent(eventName: String, params: Bundle)
}

// MARK: - Factory Interface for Dependency Injection

/**
 * Factory interface for creating audio components (SOLID - Dependency Inversion)
 * Enables easy testing through mock implementations
 */
interface AudioComponentFactory {
    fun createAudioRecorderManager(): AudioRecorderManaging
    fun createAudioPlaybackManager(): AudioPlaybackManaging
    fun createWavAudioPlayer(): WavAudioPlayerManaging
    fun createAudioEffectsManager(): AudioEffectsManaging
    fun createEventSender(): EventSenderManaging
}

// MARK: - Result Types for Safe Operations

/**
 * Sealed class representing operation results (Safe error handling)
 */
sealed class AudioOperationResult<out T> {
    data class Success<T>(val value: T) : AudioOperationResult<T>()
    data class Failure(val error: AudioModuleError) : AudioOperationResult<Nothing>()
    
    val isSuccess: Boolean get() = this is Success
    val isFailure: Boolean get() = this is Failure
    
    fun getOrNull(): T? = when (this) {
        is Success -> value
        is Failure -> null
    }
    
    fun getErrorOrNull(): AudioModuleError? = when (this) {
        is Success -> null
        is Failure -> error
    }
}

/**
 * Error types for audio operations (Comprehensive error handling)
 */
sealed class AudioModuleError(override val message: String, override val cause: Throwable? = null) : Exception(message, cause) {
    object AudioRecorderUnavailable : AudioModuleError("Audio recorder is not available")
    object AudioPlaybackUnavailable : AudioModuleError("Audio playback is not available")
    object WavPlayerUnavailable : AudioModuleError("WAV player is not available")
    object PermissionDenied : AudioModuleError("Audio permission denied")
    class InitializationFailed(message: String, cause: Throwable? = null) : AudioModuleError("Initialization failed: $message", cause)
    class OperationFailed(message: String, cause: Throwable? = null) : AudioModuleError("Operation failed: $message", cause)
    class InvalidConfiguration(message: String) : AudioModuleError("Invalid configuration: $message")
    class ThreadingError(message: String, cause: Throwable? = null) : AudioModuleError("Threading error: $message", cause)
}

// MARK: - Component State Management

/**
 * Thread-safe state management for audio components (Single Responsibility)
 */
class AudioStateManager {
    @Volatile
    private var _state: AudioComponentState = AudioComponentState.UNINITIALIZED
    
    private val stateLock = Any()
    
    val currentState: AudioComponentState
        get() = synchronized(stateLock) { _state }
    
    fun transitionTo(newState: AudioComponentState): Boolean {
        return synchronized(stateLock) {
            val isValidTransition = isValidTransition(_state, newState)
            if (isValidTransition) {
                _state = newState
            }
            isValidTransition
        }
    }
    
    fun transitionToError(error: String): Boolean {
        return synchronized(stateLock) {
            _state = AudioComponentState.ERROR
            true
        }
    }
    
    fun reset() {
        synchronized(stateLock) {
            _state = AudioComponentState.UNINITIALIZED
        }
    }
    
    private fun isValidTransition(from: AudioComponentState, to: AudioComponentState): Boolean {
        return when (from) {
            AudioComponentState.UNINITIALIZED -> to in listOf(AudioComponentState.INITIALIZING, AudioComponentState.ERROR)
            AudioComponentState.INITIALIZING -> to in listOf(AudioComponentState.READY, AudioComponentState.ERROR)
            AudioComponentState.READY -> to in listOf(AudioComponentState.ACTIVE, AudioComponentState.ERROR, AudioComponentState.DESTROYED)
            AudioComponentState.ACTIVE -> to in listOf(AudioComponentState.PAUSED, AudioComponentState.STOPPING, AudioComponentState.ERROR)
            AudioComponentState.PAUSED -> to in listOf(AudioComponentState.ACTIVE, AudioComponentState.STOPPING, AudioComponentState.ERROR)
            AudioComponentState.STOPPING -> to in listOf(AudioComponentState.READY, AudioComponentState.ERROR, AudioComponentState.DESTROYED)
            AudioComponentState.ERROR -> to in listOf(AudioComponentState.UNINITIALIZED, AudioComponentState.INITIALIZING, AudioComponentState.DESTROYED)
            AudioComponentState.DESTROYED -> false // Terminal state
        }
    }
}