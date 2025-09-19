package expo.modules.audiostream

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.app.ActivityCompat
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.audiostream.core.*
import expo.modules.audiostream.core.EventSenderManaging
import kotlinx.coroutines.*

/**
 * Refactored ExpoPlayAudioStreamModule implementing SOLID principles
 * 
 * - Single Responsibility: Manages module lifecycle and coordinates components
 * - Open/Closed: Extensible through dependency injection
 * - Liskov Substitution: Uses interfaces for all dependencies
 * - Interface Segregation: Focused interfaces for each concern
 * - Dependency Inversion: Depends on abstractions, not concrete classes
 */
class ExpoPlayAudioStreamModuleRefactored : Module(), EventSender, EventSenderManaging {
    
    // MARK: - Dependencies (Dependency Injection)
    private lateinit var componentManager: AudioComponentManager
    private lateinit var audioManager: AudioManager
    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    
    // Ensure callbacks are delivered on the main thread
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }
    private val reportedGroups = mutableSetOf<String>()
    
    // MARK: - Audio Device Management
    
    /** Map every device type to a logical group key */
    private fun groupKey(type: Int): String = when (type) {
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "BLUETOOTH"
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_USB_HEADSET -> "WIRED"
        else -> type.toString()
    }
    
    private val interestingTypes = setOf(
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_USB_HEADSET
    )
    
    private val audioCallCallback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) {
            handleAudioDeviceChange(addedDevices, "newDeviceAvailable")
        }
        
        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) {
            handleAudioDeviceChange(removedDevices, "oldDeviceUnavailable") {
                // Stop playback when device removed
                moduleScope.launch {
                    componentManager.getAudioPlaybackManager().getOrNull()?.stopPlayback(null)
                }
            }
        }
    }
    
    private fun handleAudioDeviceChange(
        devices: Array<out AudioDeviceInfo>?,
        reason: String,
        additionalAction: (() -> Unit)? = null
    ) {
        val relevantDevices = devices?.filter { device ->
            device.type in interestingTypes && when (reason) {
                "newDeviceAvailable" -> reportedGroups.add(groupKey(device.type))
                else -> reportedGroups.remove(groupKey(device.type))
            }
        }
        
        if (relevantDevices?.isNotEmpty() == true) {
            Log.d("ExpoAudioCallback", "AudioDeviceCallback ➜ ${reason.uppercase()}")
            additionalAction?.invoke()
            
            val params = Bundle().apply {
                putString("reason", reason)
            }
            sendExpoEvent(Constants.DEVICE_RECONNECTED_EVENT_NAME, params)
        }
    }
    
    // MARK: - Module Definition
    
    @SuppressLint("MissingPermission")
    @RequiresApi(Build.VERSION_CODES.R)
    override fun definition() = ModuleDefinition {
        Name("ExpoPlayAudioStream")
        
        Events(
            Constants.AUDIO_EVENT_NAME,
            Constants.SOUND_CHUNK_PLAYED_EVENT_NAME,
            Constants.SOUND_STARTED_EVENT_NAME,
            Constants.DEVICE_RECONNECTED_EVENT_NAME
        )
        
        OnCreate {
            moduleScope.launch {
                initializeModule()
            }
        }
        
        OnDestroy {
            destroyModule()
        }
        
        Function("destroy") {
            moduleScope.launch {
                componentManager.reset()
            }
        }
        
        // MARK: - Recording Functions
        
        AsyncFunction("startRecording") { options: Map<String, Any?>, promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val recorder = componentManager.getAudioRecorderManager().getOrThrow()
                    val config = parseRecordingConfig(options)
                    recorder.startRecording(config, promise)
                }
            }
        }
        
        AsyncFunction("pauseRecording") { promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val recorder = componentManager.getAudioRecorderManager().getOrThrow()
                    recorder.pauseRecording(promise)
                }
            }
        }
        
        AsyncFunction("resumeRecording") { promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val recorder = componentManager.getAudioRecorderManager().getOrThrow()
                    recorder.resumeRecording(promise)
                }
            }
        }
        
        AsyncFunction("stopRecording") { promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val recorder = componentManager.getAudioRecorderManager().getOrThrow()
                    recorder.stopRecording(promise)
                }
            }
        }
        
        Function("toggleSilence") {
            moduleScope.launch {
                componentManager.getAudioRecorderManager().getOrNull()?.toggleSilence()
            }
        }
        
        // MARK: - Playback Functions
        
        AsyncFunction("playAudio") { base64chunk: String, turnId: String, encoding: String?, promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val playback = componentManager.getAudioPlaybackManager().getOrThrow()
                    playback.playAudio(base64chunk, turnId, encoding, promise)
                }
            }
        }
        
        AsyncFunction("clearPlaybackQueueByTurnId") { turnId: String, promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val playback = componentManager.getAudioPlaybackManager().getOrThrow()
                    playback.clearPlaybackQueueByTurnId(turnId, promise)
                }
            }
        }
        
        AsyncFunction("pauseAudio") { promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val playback = componentManager.getAudioPlaybackManager().getOrThrow()
                    playback.pausePlayback(promise)
                }
            }
        }
        
        AsyncFunction("stopAudio") { promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val playback = componentManager.getAudioPlaybackManager().getOrThrow()
                    playback.stopPlayback(promise)
                }
            }
        }
        
        // MARK: - WAV Player Functions
        
        AsyncFunction("playWav") { base64Data: String, promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val wavPlayer = componentManager.getWavAudioPlayer().getOrThrow()
                    wavPlayer.playWav(base64Data, promise)
                }
            }
        }
        
        AsyncFunction("stopWav") { promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val wavPlayer = componentManager.getWavAudioPlayer().getOrThrow()
                    wavPlayer.stop()
                    promise.resolve(null)
                }
            }
        }
        
        AsyncFunction("setSoundConfig") { config: Map<String, Any?>, promise: Promise ->
            moduleScope.launch {
                handleSafeOperation(promise) {
                    val useDefault = config["useDefault"] as? Boolean ?: false
                    val playbackManager = componentManager.getAudioPlaybackManager().getOrThrow()
                    
                    if (useDefault) {
                        // Reset to default configuration
                        Log.d("ExpoPlayAudioStreamModuleRefactored", "Resetting sound configuration to default values")
                        playbackManager.resetConfigToDefault(promise)
                    } else {
                        // Extract configuration values
                        val sampleRate = (config["sampleRate"] as? Number)?.toInt() ?: 16000
                        val playbackModeString = config["playbackMode"] as? String ?: "regular"
                        
                        // Convert string playback mode to enum
                        val playbackMode = when (playbackModeString) {
                            "voiceProcessing" -> PlaybackMode.VOICE_PROCESSING
                            "conversation" -> PlaybackMode.CONVERSATION
                            else -> PlaybackMode.REGULAR
                        }
                        
                        // Create a new SoundConfig object
                        val soundConfig = SoundConfig(sampleRate = sampleRate, playbackMode = playbackMode)
                        
                        // Update the sound player configuration
                        Log.d("ExpoPlayAudioStreamModuleRefactored", "Setting sound configuration - sampleRate: $sampleRate, playbackMode: $playbackModeString")
                        playbackManager.updateConfig(soundConfig, promise)
                    }
                }
            }
        }
        
        // MARK: - Permission Functions
        
        AsyncFunction("requestPermissionsAsync") { promise: Promise ->
            Permissions.askForPermissionsWithPermissionsManager(
                appContext.permissions,
                promise,
                Manifest.permission.RECORD_AUDIO
            )
        }
        
        AsyncFunction("getPermissionsAsync") { promise: Promise ->
            Permissions.getPermissionsWithPermissionsManager(
                appContext.permissions,
                promise,
                Manifest.permission.RECORD_AUDIO
            )
        }
        
        // MARK: - Health Check Functions
        
        AsyncFunction("getHealthStatus") { promise: Promise ->
            moduleScope.launch {
                try {
                    val healthStatus = componentManager.getHealthStatus()
                    promise.resolve(healthStatus)
                } catch (e: Exception) {
                    promise.reject("HEALTH_CHECK_ERROR", e.message, e)
                }
            }
        }
    }
    
    // MARK: - Private Helper Methods
    
    private suspend fun initializeModule() {
        try {
            // Initialize audio manager
            audioManager = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.registerAudioDeviceCallback(audioCallCallback, mainHandler)
            
            // Initialize component manager with dependency injection
            val factory = DefaultAudioComponentFactory(
                context = appContext.reactContext!!,
                eventSender = this@ExpoPlayAudioStreamModuleRefactored
            )
            
            componentManager = AudioComponentManager.getInstance(factory, appContext.reactContext!!)
            
        } catch (e: Exception) {
            Log.e("ExpoPlayAudioStreamModule", "Initialization failed", e)
            throw e
        }
    }
    
    private fun destroyModule() {
        try {
            reportedGroups.clear()
            audioManager.unregisterAudioDeviceCallback(audioCallCallback)
            
            // Cancel all coroutines
            moduleScope.cancel()
            
            // Destroy component manager
            CoroutineScope(Dispatchers.Main).launch {
                componentManager.destroy()
            }
            
        } catch (e: Exception) {
            Log.e("ExpoPlayAudioStreamModule", "Destroy failed", e)
        }
    }
    
    private suspend inline fun handleSafeOperation(
        promise: Promise,
        crossinline operation: suspend () -> Unit
    ) {
        try {
            operation()
        } catch (e: Exception) {
            Log.e("ExpoPlayAudioStreamModule", "Operation failed", e)
            promise.reject("OPERATION_ERROR", e.message, e)
        }
    }
    
    private fun parseRecordingConfig(options: Map<String, Any?>): expo.modules.audiostream.core.RecordingConfig {
        // Parse options into RecordingConfig
        // Implementation details...
        return expo.modules.audiostream.core.RecordingConfig()
    }
    
    // MARK: - AudioOperationResult Extension
    
    private fun <T> AudioOperationResult<T>.getOrThrow(): T {
        return when (this) {
            is AudioOperationResult.Success -> value
            is AudioOperationResult.Failure -> throw error
        }
    }
    
    private fun <T> AudioOperationResult<T>.getOrNull(): T? {
        return when (this) {
            is AudioOperationResult.Success -> value
            is AudioOperationResult.Failure -> null
        }
    }
    
    // MARK: - EventSender Implementation
    
    override fun sendExpoEvent(eventName: String, params: Bundle) {
        try {
            sendEvent(eventName, params)
        } catch (e: Exception) {
            Log.e("ExpoPlayAudioStreamModule", "Failed to send event: $eventName", e)
        }
    }
}