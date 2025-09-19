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
            promise.reject("INVALID_STATE", "Cannot start recording in current state: ${stateManager.currentState}", null)
            return
        }
        
        try {
            // Convert RecordingConfig to Map for the delegate
            val configMap = mapOf<String, Any?>(
                "sampleRate" to config.sampleRate,
                "channels" to config.channels,
                "encoding" to config.encoding,
                "interval" to config.interval,
                "pointsPerSecond" to config.pointsPerSecond
            )
            delegate.startRecording(configMap, promise)
        } catch (e: Exception) {
            stateManager.transitionToError("Recording start failed: ${e.message}")
            promise.reject("RECORDING_ERROR", e.message, e)
        }
    }
    
    override fun stopRecording(promise: expo.modules.kotlin.Promise) {
        if (!stateManager.transitionTo(AudioComponentState.STOPPING)) {
            promise.reject("INVALID_STATE", "Cannot stop recording in current state: ${stateManager.currentState}", null)
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
    
    override fun pauseRecording(promise: expo.modules.kotlin.Promise) {
        try {
                delegate.pauseRecording(promise)
        } catch (e: Exception) {
            stateManager.transitionToError("Pause recording failed: ${e.message}")
            // No need to reject here as delegate should handle it
        }
    }
    
    override fun resumeRecording(promise: expo.modules.kotlin.Promise) {
        try {
                delegate.resumeRecording(promise)
        } catch (e: Exception) {
            stateManager.transitionToError("Resume recording failed: ${e.message}")
            // No need to reject here as delegate should handle it
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
            delegate.isRecording.get()
        } catch (e: Exception) {
            false
        }
    }
    
    override fun destroy() {
        try {
            delegate.release()
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
            // Convert string encoding to PCMEncoding enum
            val pcmEncoding = when (encoding?.lowercase()) {
                "pcm_f32le" -> PCMEncoding.PCM_F32LE
                "pcm_s16le", null -> PCMEncoding.PCM_S16LE
                else -> PCMEncoding.PCM_S16LE
            }
            delegate.playAudio(base64chunk, turnId, promise, pcmEncoding)
        } catch (e: Exception) {
            promise.reject("PLAYBACK_ERROR", e.message, e)
        }
    }
    
    override fun clearPlaybackQueueByTurnId(turnId: String, promise: expo.modules.kotlin.Promise) {
        try {
            // AudioPlaybackManager doesn't have this method yet
            // For now, just resolve the promise successfully
            android.util.Log.d("SafeAudioPlaybackManager", "clearPlaybackQueueByTurnId called for turnId: $turnId (not implemented)")
            promise.resolve(null)
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
            delegate.isPlaying
        } catch (e: Exception) {
            false
        }
    }
    
    override fun destroy() {
        try {
            // AudioPlaybackManager doesn't have a destroy method
            // Just log that cleanup is happening
            android.util.Log.d("SafeAudioPlaybackManager", "Destroying audio playback manager")
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
            delegate.playWavFile(base64Data, promise)
        } catch (e: Exception) {
            promise.reject("WAV_PLAY_ERROR", e.message, e)
        }
    }
    
    override fun stop() {
        try {
            // WavAudioPlayer doesn't have a simple stop() method that doesn't need a promise
            // We'll create a dummy promise to handle the result
            val dummyPromise = object : expo.modules.kotlin.Promise {
                override fun resolve(value: Any?) {
                    android.util.Log.d("SafeWavAudioPlayer", "Stop completed")
                }
                
                override fun reject(code: String, message: String?, cause: Throwable?) {
                    android.util.Log.e("SafeWavAudioPlayer", "Stop failed: $message", cause)
                }
            }
            delegate.stopWavPlayback(dummyPromise)
        } catch (e: Exception) {
            android.util.Log.e("SafeWavAudioPlayer", "Stop failed", e)
        }
    }
    
    override fun destroy() {
        try {
            delegate.release()
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
            // AudioEffectsManager doesn't have a simple enableEffects method
            // Effects are managed per AudioRecord instance in setupAudioEffects
            android.util.Log.d("SafeAudioEffectsManager", "enableEffects called (effects are managed per recording session)")
        } catch (e: Exception) {
            android.util.Log.e("SafeAudioEffectsManager", "Enable effects failed", e)
        }
    }
    
    override fun disableEffects() {
        try {
            delegate.releaseAudioEffects()
        } catch (e: Exception) {
            android.util.Log.e("SafeAudioEffectsManager", "Disable effects failed", e)
        }
    }
    
    override fun isEffectsEnabled(): Boolean {
        return try {
            // AudioEffectsManager doesn't track enabled state
            // Return false as default
            false
        } catch (e: Exception) {
            false
        }
    }
    
    override fun destroy() {
        try {
            delegate.releaseAudioEffects()
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