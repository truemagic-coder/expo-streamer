package expo.modules.audiostream.core

import android.content.Context
import expo.modules.audiostream.*
import java.io.File

/**
 * Default factory implementation for creating audio components
 * Implements SOLID principles - can be easily swapped for testing or different implementations
 */
class DefaultAudioComponentFactory(
    private val context: Context,
    private val eventSender: EventSenderManaging? = null
) : AudioComponentFactory {
    
    override fun createAudioRecorderManager(): AudioRecorderManaging {
        return SafeAudioRecorderManager(
            filesDir = context.filesDir,
            permissionUtils = PermissionUtils(context),
            audioDataEncoder = AudioDataEncoder(),
            eventSender = eventSender ?: createEventSender(),
            audioEffectsManager = SafeAudioEffectsManager()
        )
    }
    
    override fun createAudioPlaybackManager(): AudioPlaybackManaging {
        return SafeAudioPlaybackManager(
            eventSender = eventSender ?: createEventSender()
        )
    }
    
    override fun createWavAudioPlayer(): WavAudioPlayerManaging {
        return SafeWavAudioPlayer()
    }
    
    override fun createAudioEffectsManager(): AudioEffectsManaging {
        return SafeAudioEffectsManager()
    }
    
    override fun createEventSender(): EventSenderManaging {
        return SafeEventSender()
    }
}

/**
 * Safe wrapper for AudioRecorderManager implementing the interface
 * Adds error handling and state management to the existing implementation
 */
class SafeAudioRecorderManager(
    filesDir: File,
    permissionUtils: PermissionUtils,
    audioDataEncoder: AudioDataEncoder,
    eventSender: EventSenderManaging,
    audioEffectsManager: AudioEffectsManaging
) : AudioRecorderManaging {
    
    private val stateManager = AudioStateManager()
    private val delegate: AudioRecorderManager by lazy {
        AudioRecorderManager(
            filesDir = filesDir,
            permissionUtils = permissionUtils as PermissionUtils,
            audioDataEncoder = audioDataEncoder,
            eventSender = eventSender as EventSender,
            audioEffectsManager = audioEffectsManager as AudioEffectsManager
        )
    }
    
    override fun startRecording(config: RecordingConfig, promise: expo.modules.kotlin.Promise) {
        if (!stateManager.transitionTo(AudioComponentState.ACTIVE)) {
            promise.reject("INVALID_STATE", "Cannot start recording in current state: ${stateManager.currentState}")
            return
        }
        
        try {
            delegate.startRecording(config, promise)
        } catch (e: Exception) {
            stateManager.transitionToError("Recording start failed: ${e.message}")
            promise.reject("RECORDING_ERROR", e.message, e)
        }
    }
    
    override fun stopRecording(promise: expo.modules.kotlin.Promise) {
        if (!stateManager.transitionTo(AudioComponentState.STOPPING)) {
            promise.reject("INVALID_STATE", "Cannot stop recording in current state: ${stateManager.currentState}")
            return
        }
        
        try {
            delegate.stopRecording(promise)
            stateManager.transitionTo(AudioComponentState.READY)
        } catch (e: Exception) {
            stateManager.transitionToError("Recording stop failed: ${e.message}")
            promise.reject("RECORDING_ERROR", e.message, e)
        }
    }
    
    override fun pauseRecording() {
        if (stateManager.transitionTo(AudioComponentState.PAUSED)) {
            try {
                delegate.pauseRecording()
            } catch (e: Exception) {
                stateManager.transitionToError("Recording pause failed: ${e.message}")
            }
        }
    }
    
    override fun resumeRecording() {
        if (stateManager.transitionTo(AudioComponentState.ACTIVE)) {
            try {
                delegate.resumeRecording()
            } catch (e: Exception) {
                stateManager.transitionToError("Recording resume failed: ${e.message}")
            }
        }
    }
    
    override fun toggleSilence() {
        try {
            delegate.toggleSilence()
        } catch (e: Exception) {
            android.util.Log.e("SafeAudioRecorderManager", "Toggle silence failed", e)
        }
    }
    
    override fun isRecording(): Boolean {
        return try {
            delegate.isRecording()
        } catch (e: Exception) {
            false
        }
    }
    
    override fun destroy() {
        try {
            delegate.destroy()
        } catch (e: Exception) {
            android.util.Log.e("SafeAudioRecorderManager", "Destroy failed", e)
        } finally {
            stateManager.reset()
        }
    }
}

/**
 * Safe wrapper for AudioPlaybackManager implementing the interface
 */
class SafeAudioPlaybackManager(
    private val eventSender: EventSenderManaging
) : AudioPlaybackManaging {
    
    private val stateManager = AudioStateManager()
    private val delegate: AudioPlaybackManager by lazy {
        AudioPlaybackManager(eventSender as EventSender)
    }
    
    override fun playAudio(base64chunk: String, turnId: String, encoding: String?, promise: expo.modules.kotlin.Promise) {
        try {
            delegate.playAudio(base64chunk, turnId, encoding, promise)
        } catch (e: Exception) {
            promise.reject("PLAYBACK_ERROR", e.message, e)
        }
    }
    
    override fun clearPlaybackQueueByTurnId(turnId: String, promise: expo.modules.kotlin.Promise) {
        try {
            delegate.clearPlaybackQueueByTurnId(turnId, promise)
        } catch (e: Exception) {
            promise.reject("CLEAR_QUEUE_ERROR", e.message, e)
        }
    }
    
    override fun pausePlayback(promise: expo.modules.kotlin.Promise?) {
        try {
            delegate.pausePlayback(promise)
        } catch (e: Exception) {
            promise?.reject("PAUSE_ERROR", e.message, e)
        }
    }
    
    override fun stopPlayback(promise: expo.modules.kotlin.Promise?) {
        try {
            delegate.stopPlayback(promise)
        } catch (e: Exception) {
            promise?.reject("STOP_ERROR", e.message, e)
        }
    }
    
    override fun isPlaying(): Boolean {
        return try {
            delegate.isPlaying()
        } catch (e: Exception) {
            false
        }
    }
    
    override fun destroy() {
        try {
            delegate.destroy()
        } catch (e: Exception) {
            android.util.Log.e("SafeAudioPlaybackManager", "Destroy failed", e)
        }
    }
}

/**
 * Safe wrapper for WavAudioPlayer implementing the interface
 */
class SafeWavAudioPlayer : WavAudioPlayerManaging {
    private val stateManager = AudioStateManager()
    private val delegate: WavAudioPlayer by lazy { WavAudioPlayer() }
    
    override fun playWav(base64Data: String, promise: expo.modules.kotlin.Promise) {
        try {
            delegate.playWav(base64Data, promise)
        } catch (e: Exception) {
            promise.reject("WAV_PLAY_ERROR", e.message, e)
        }
    }
    
    override fun stop() {
        try {
            delegate.stop()
        } catch (e: Exception) {
            android.util.Log.e("SafeWavAudioPlayer", "Stop failed", e)
        }
    }
    
    override fun destroy() {
        try {
            delegate.destroy()
        } catch (e: Exception) {
            android.util.Log.e("SafeWavAudioPlayer", "Destroy failed", e)
        }
    }
}

/**
 * Safe wrapper for AudioEffectsManager implementing the interface
 */
class SafeAudioEffectsManager : AudioEffectsManaging {
    private val delegate: AudioEffectsManager by lazy { AudioEffectsManager() }
    
    override fun enableEffects() {
        try {
            delegate.enableEffects()
        } catch (e: Exception) {
            android.util.Log.e("SafeAudioEffectsManager", "Enable effects failed", e)
        }
    }
    
    override fun disableEffects() {
        try {
            delegate.disableEffects()
        } catch (e: Exception) {
            android.util.Log.e("SafeAudioEffectsManager", "Disable effects failed", e)
        }
    }
    
    override fun isEffectsEnabled(): Boolean {
        return try {
            delegate.isEffectsEnabled()
        } catch (e: Exception) {
            false
        }
    }
    
    override fun destroy() {
        try {
            delegate.destroy()
        } catch (e: Exception) {
            android.util.Log.e("SafeAudioEffectsManager", "Destroy failed", e)
        }
    }
}

/**
 * Safe event sender implementation
 */
class SafeEventSender : EventSenderManaging, EventSender {
    override fun sendExpoEvent(eventName: String, params: android.os.Bundle) {
        try {
            // Implementation will be provided by the actual module
            android.util.Log.d("SafeEventSender", "Event: $eventName")
        } catch (e: Exception) {
            android.util.Log.e("SafeEventSender", "Failed to send event: $eventName", e)
        }
    }
}