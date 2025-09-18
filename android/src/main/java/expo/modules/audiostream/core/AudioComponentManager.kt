package expo.modules.audiostream.core

import android.content.Context
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.ConcurrentHashMap

/**
 * Thread-safe component manager implementing dependency injection (SOLID principles)
 * 
 * - Single Responsibility: Manages component lifecycle and creation
 * - Open/Closed: Extensible through factory interface
 * - Dependency Inversion: Depends on abstractions (interfaces), not concretions
 */
class AudioComponentManager private constructor(
    private val factory: AudioComponentFactory,
    private val context: Context
) {
    
    // Thread-safe component storage
    private val components = ConcurrentHashMap<ComponentType, Any>()
    private val componentMutex = Mutex()
    
    // Singleton pattern with thread safety
    companion object {
        @Volatile
        private var INSTANCE: AudioComponentManager? = null
        private val instanceMutex = Mutex()
        
        suspend fun getInstance(factory: AudioComponentFactory, context: Context): AudioComponentManager {
            return INSTANCE ?: instanceMutex.withLock {
                INSTANCE ?: AudioComponentManager(factory, context).also { INSTANCE = it }
            }
        }
        
        // For testing - allows injection of mock factory
        suspend fun getTestInstance(factory: AudioComponentFactory, context: Context): AudioComponentManager {
            return instanceMutex.withLock {
                AudioComponentManager(factory, context)
            }
        }
        
        suspend fun destroyInstance() {
            instanceMutex.withLock {
                INSTANCE?.destroy()
                INSTANCE = null
            }
        }
    }
    
    private enum class ComponentType {
        AUDIO_RECORDER,
        AUDIO_PLAYBACK,
        WAV_PLAYER,
        AUDIO_EFFECTS,
        EVENT_SENDER
    }
    
    // MARK: - Component Access Methods
    
    suspend fun getAudioRecorderManager(): AudioOperationResult<AudioRecorderManaging> {
        return getOrCreateComponent(ComponentType.AUDIO_RECORDER) {
            factory.createAudioRecorderManager()
        }
    }
    
    suspend fun getAudioPlaybackManager(): AudioOperationResult<AudioPlaybackManaging> {
        return getOrCreateComponent(ComponentType.AUDIO_PLAYBACK) {
            factory.createAudioPlaybackManager()
        }
    }
    
    suspend fun getWavAudioPlayer(): AudioOperationResult<WavAudioPlayerManaging> {
        return getOrCreateComponent(ComponentType.WAV_PLAYER) {
            factory.createWavAudioPlayer()
        }
    }
    
    suspend fun getAudioEffectsManager(): AudioOperationResult<AudioEffectsManaging> {
        return getOrCreateComponent(ComponentType.AUDIO_EFFECTS) {
            factory.createAudioEffectsManager()
        }
    }
    
    suspend fun getEventSender(): AudioOperationResult<EventSenderManaging> {
        return getOrCreateComponent(ComponentType.EVENT_SENDER) {
            factory.createEventSender()
        }
    }
    
    // MARK: - Private Helper Methods
    
    @Suppress("UNCHECKED_CAST")
    private suspend inline fun <T> getOrCreateComponent(
        type: ComponentType,
        crossinline creator: () -> T
    ): AudioOperationResult<T> {
        return componentMutex.withLock {
            try {
                val existing = components[type] as? T
                if (existing != null) {
                    AudioOperationResult.Success(existing)
                } else {
                    val component = creator()
                    components[type] = component as Any
                    AudioOperationResult.Success(component)
                }
            } catch (e: Exception) {
                AudioOperationResult.Failure(
                    AudioModuleError.InitializationFailed("Failed to create component $type", e)
                )
            }
        }
    }
    
    // MARK: - Lifecycle Management
    
    suspend fun destroy() {
        componentMutex.withLock {
            // Destroy components in reverse order of creation
            components.values.forEach { component ->
                try {
                    when (component) {
                        is AudioRecorderManaging -> component.destroy()
                        is AudioPlaybackManaging -> component.destroy()
                        is WavAudioPlayerManaging -> component.destroy()
                        is AudioEffectsManaging -> component.destroy()
                        // EventSender doesn't need destruction
                    }
                } catch (e: Exception) {
                    // Log error but continue cleanup
                    android.util.Log.e("AudioComponentManager", "Error destroying component", e)
                }
            }
            components.clear()
        }
    }
    
    suspend fun reset() {
        destroy()
        // Components will be recreated on next access
    }
    
    // MARK: - Health Check
    
    suspend fun getHealthStatus(): Map<String, Boolean> {
        return componentMutex.withLock {
            mapOf(
                "audioRecorder" to components.containsKey(ComponentType.AUDIO_RECORDER),
                "audioPlayback" to components.containsKey(ComponentType.AUDIO_PLAYBACK),
                "wavPlayer" to components.containsKey(ComponentType.WAV_PLAYER),
                "audioEffects" to components.containsKey(ComponentType.AUDIO_EFFECTS),
                "eventSender" to components.containsKey(ComponentType.EVENT_SENDER)
            )
        }
    }
}