// RecordingSettings.swift

import Foundation

struct RecordingSettings {
    var sampleRate: Double
    var desiredSampleRate: Double
    var numberOfChannels: Int = 1
    var bitDepth: Int = 16
    var voiceProcessingEnabled: Bool = false
    var preGainDb: Double = 0.0
    var maxRecentDataDuration: Double? = 10.0 // Default to 10 seconds
    var pointsPerSecond: Int? = 1000 // Default value

    var linearGain: Float {
        let clampedDb = max(-24.0, min(24.0, preGainDb))
        return Float(pow(10.0, clampedDb / 20.0))
    }
}

