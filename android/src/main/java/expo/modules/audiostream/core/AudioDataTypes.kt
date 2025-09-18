package expo.modules.audiostream.core

/**
 * Configuration for audio recording operations
 * Implements value object pattern for immutable configuration
 */
data class RecordingConfig(
    val sampleRate: Int = 44100,
    val channels: Int = 1,
    val bitDepth: Int = 16,
    val encoding: String = "pcm",
    val bufferSize: Int = 4096,
    val enableVoiceDetection: Boolean = false,
    val noiseReduction: Boolean = true,
    val echoCancellation: Boolean = true
) {
    
    companion object {
        const val DEFAULT_SAMPLE_RATE = 44100
        const val DEFAULT_CHANNELS = 1
        const val DEFAULT_BIT_DEPTH = 16
        const val DEFAULT_BUFFER_SIZE = 4096
        
        fun defaultConfig(): RecordingConfig = RecordingConfig()
        
        fun fromMap(options: Map<String, Any?>): RecordingConfig {
            return RecordingConfig(
                sampleRate = (options["sampleRate"] as? Number)?.toInt() ?: DEFAULT_SAMPLE_RATE,
                channels = (options["channels"] as? Number)?.toInt() ?: DEFAULT_CHANNELS,
                bitDepth = (options["bitDepth"] as? Number)?.toInt() ?: DEFAULT_BIT_DEPTH,
                encoding = options["encoding"] as? String ?: "pcm",
                bufferSize = (options["bufferSize"] as? Number)?.toInt() ?: DEFAULT_BUFFER_SIZE,
                enableVoiceDetection = options["enableVoiceDetection"] as? Boolean ?: false,
                noiseReduction = options["noiseReduction"] as? Boolean ?: true,
                echoCancellation = options["echoCancellation"] as? Boolean ?: true
            )
        }
    }
    
    /**
     * Validates the recording configuration
     * @return true if configuration is valid, false otherwise
     */
    fun isValid(): Boolean {
        return sampleRate > 0 &&
               channels in 1..2 &&
               bitDepth in listOf(8, 16, 24, 32) &&
               bufferSize > 0 &&
               encoding.isNotBlank()
    }
    
    /**
     * Gets the bytes per sample based on bit depth
     */
    fun getBytesPerSample(): Int = bitDepth / 8
    
    /**
     * Gets the frame size (bytes per frame)
     */
    fun getFrameSize(): Int = channels * getBytesPerSample()
}

/**
 * Constants used throughout the audio streaming module
 */
object Constants {
    // Event names
    const val AUDIO_EVENT_NAME = "ExpoPlayAudioStream.onAudioData"
    const val SOUND_CHUNK_PLAYED_EVENT_NAME = "ExpoPlayAudioStream.onSoundChunkPlayed"
    const val SOUND_STARTED_EVENT_NAME = "ExpoPlayAudioStream.onSoundStarted"
    const val DEVICE_RECONNECTED_EVENT_NAME = "ExpoPlayAudioStream.onDeviceReconnected"
    
    // Audio settings
    const val DEFAULT_SAMPLE_RATE = 44100
    const val DEFAULT_BUFFER_SIZE = 4096
    const val DEFAULT_CHANNELS = 1
    const val DEFAULT_BIT_DEPTH = 16
    
    // Error codes
    const val ERROR_INITIALIZATION_FAILED = "INITIALIZATION_FAILED"
    const val ERROR_RECORDING_FAILED = "RECORDING_FAILED"
    const val ERROR_PLAYBACK_FAILED = "PLAYBACK_FAILED"
    const val ERROR_PERMISSION_DENIED = "PERMISSION_DENIED"
    const val ERROR_INVALID_CONFIGURATION = "INVALID_CONFIGURATION"
    const val ERROR_COMPONENT_NOT_AVAILABLE = "COMPONENT_NOT_AVAILABLE"
    
    // Audio formats
    const val FORMAT_PCM = "pcm"
    const val FORMAT_WAV = "wav"
    const val FORMAT_MP3 = "mp3"
    const val FORMAT_AAC = "aac"
}

/**
 * Represents the current state of an audio component
 */
enum class AudioComponentState {
    UNINITIALIZED,
    INITIALIZING,
    READY,
    ACTIVE,
    PAUSED,
    ERROR,
    DESTROYED
}

/**
 * Audio quality settings for different use cases
 */
enum class AudioQuality(
    val sampleRate: Int,
    val bitDepth: Int,
    val channels: Int
) {
    LOW(22050, 16, 1),
    VOICE(24000, 16, 1),    // Optimized for voice processing
    MEDIUM(44100, 16, 1),
    HIGH(48000, 24, 2),
    ULTRA(96000, 32, 2);
    
    fun toRecordingConfig(): RecordingConfig {
        return RecordingConfig(
            sampleRate = sampleRate,
            bitDepth = bitDepth,
            channels = channels
        )
    }
}