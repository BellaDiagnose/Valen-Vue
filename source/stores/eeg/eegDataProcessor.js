/**
 * EEG Data Processor
 * Handles buffer management and data processing
 */
import { mockEEG } from '../../mock.js';

export default class EegDataProcessor {
  constructor(store) {
    this.store = store;
    this.dataUpdateInterval = null;
    this.debug = false; // Enable for debugging
  }

  /**
   * Initialize circular buffers for all channels
   */
  initializeCircularBuffers() {
    const { buffer, sensorData } = this.store;
    
    // Create fixed-size arrays filled with zeros for each channel
    for (const channel of ['fp1', 'fpz', 'fp2']) {
      buffer.circular[channel] = new Array(buffer.maxPoints).fill(0);
      buffer.writeIndex[channel] = 0;
    }
    buffer.startTime = performance.now();
    buffer.hasNewData = false;
    
    if (window.appLogger) window.appLogger.info('Initialized circular buffers');
  }

  /**
   * Process data from the incoming buffer into the circular buffers
   */
  processIncomingBuffer() {
    const { buffer, sensorData, isMockMode } = this.store;
    
    // Handle mock mode specially to ensure continuous data
    if (isMockMode && (!buffer.lastMockUpdateTime || performance.now() - buffer.lastMockUpdateTime > 100)) {
      // Use mockEEG from mock.js to generate new mock data
      mockEEG.generateMockData(this.store);
    }
    
    // Normalize incoming data if needed
    this.normalizeIncomingData();
    
    // Process each channel
    const hasProcessedData = this.processChannels();
    
    // In mock mode, ensure we always have new data
    if (isMockMode && !hasProcessedData) {
      buffer.hasNewData = true;
    }

    return {
      hasIncomingData: hasProcessedData,
      bufferStats: {
        writeIndices: { ...buffer.writeIndex },
        hasNewData: buffer.hasNewData
      },
      channels: [...sensorData.channels],
      hasData: this.hasAnyData()
    };
  }
  
  /**
   * Check if we have data for any channel
   */
  hasAnyData() {
    const { sensorData } = this.store;
    for (const channel of sensorData.channels) {
      if (channel === 'snr') continue;
      if (this.hasData(channel)) return true;
    }
    return false;
  }
  
  /**
   * Process data channels from incoming buffer to circular buffer
   * @returns {boolean} Whether any data was processed
   */
  processChannels() {
    const { buffer, sensorData } = this.store;
    let hasProcessedData = false;
    
    // For each active channel (except SNR)
    for (const channel of sensorData.channels) {
      if (channel === 'snr') continue; // Skip SNR as it's not a time series
      
      if (buffer.incoming[channel] && buffer.incoming[channel].length > 0) {
        // Get incoming data
        const newData = buffer.incoming[channel];
        
        if (this.debug) {
          console.log(`Processing channel ${channel}: ${newData.length} points`);
        }
        
        // Add each point to the circular buffer
        for (let i = 0; i < newData.length; i++) {
          // Write to the circular buffer at the current write index
          buffer.circular[channel][buffer.writeIndex[channel]] = newData[i];
          
          // Increment write index with wrap-around
          buffer.writeIndex[channel] = 
            (buffer.writeIndex[channel] + 1) % buffer.maxPoints;
        }
        
        // Also update the main data arrays for API compatibility
        sensorData.data[channel].push(...newData);
        
        // Trim if exceeds maximum buffer size
        if (sensorData.data[channel].length > buffer.maxPoints) {
          sensorData.data[channel] = sensorData.data[channel].slice(-buffer.maxPoints);
        }
        
        // Clear the incoming buffer
        buffer.incoming[channel] = [];
        
        // Set flag that new data is available
        buffer.hasNewData = true;
        hasProcessedData = true;
      }
    }
    
    return hasProcessedData;
  }
  
  /**
   * Normalize incoming data to ensure consistent scaling
   */
  normalizeIncomingData() {
    const { buffer, sensorData } = this.store;
    
    // Calculate a normalization factor for each channel if needed
    const channels = sensorData.channels.filter(ch => ch !== 'snr');
    
    // Skip if no channels
    if (channels.length === 0) return;
    
    // Check if normalization is needed based on data amplitude
    let needsNormalization = false;
    let maxAmplitude = 0;
    
    for (const channel of channels) {
      if (!buffer.incoming[channel] || buffer.incoming[channel].length === 0) continue;
      
      // Find max amplitude in incoming data
      const channelMax = Math.max(...buffer.incoming[channel].map(Math.abs));
      maxAmplitude = Math.max(maxAmplitude, channelMax);
      
      // If amplitude is very large, normalization is needed
      if (channelMax > 100) {
        needsNormalization = true;
      }
    }
    
    // Apply normalization if needed (scale values to more reasonable range)
    if (needsNormalization && maxAmplitude > 0) {
      const targetScale = 50; // Target max amplitude around 50μV
      const scaleFactor = targetScale / maxAmplitude;
      
      console.log(`Normalizing EEG data with scale factor: ${scaleFactor.toFixed(3)}`);
      
      for (const channel of channels) {
        if (!buffer.incoming[channel] || buffer.incoming[channel].length === 0) continue;
        
        // Scale the data
        buffer.incoming[channel] = buffer.incoming[channel].map(val => val * scaleFactor);
      }
    }
  }

  /**
   * Check if we have data for a channel
   */
  hasData(channel) {
    return Array.isArray(this.store.sensorData.data[channel]) && 
           this.store.sensorData.data[channel].length > 0;
  }
  
  /**
   * Get the latest value for a channel from the circular buffer
   */
  getLatestValue(channel) {
    const { buffer } = this.store;
    if (!buffer.circular[channel]) return 0;
    
    // Get the previous index (the last written value)
    const prevIndex = (buffer.writeIndex[channel] - 1 + buffer.maxPoints) % buffer.maxPoints;
    return buffer.circular[channel][prevIndex];
  }

  /**
   * Start recording EEG data
   */
  startRecording() {
    const { isMockMode, buffer } = this.store;

    if (isMockMode) {
      // Trigger mock data generation immediately
      mockEEG.generateMockData(this.store);
      buffer.hasNewData = true;

      // Ensure continuous mock data generation
      if (!this.dataUpdateInterval) {
        this.dataUpdateInterval = setInterval(() => {
          mockEEG.generateMockData(this.store);
          buffer.hasNewData = true;
        }, 100); // Generate mock data every 100ms
      }
    }

    // Additional logic to start recording (e.g., initializing buffers)
    this.initializeCircularBuffers();
  }

  /**
   * Update EEG data from an external source (native bridge)
   */
  updateEEGData(data) {
    if (!data) return false;
    
    try {
      const { sensorData, buffer, eegPlot } = this.store;
      
      // Handle EEG data structure
      if (data.eeg) {
        // Update sensor information
        sensorData.sensor = data.eeg.sensor || '';
        sensorData.channels = data.eeg.channels || [];
        
        // Update data arrays
        if (data.eeg.data) {
          // Handle each channel separately
          for (const channel of sensorData.channels) {
            if (channel === 'snr') {
              // Handle SNR differently since it's not a time series
              if (data.eeg.data.snr) {
                sensorData.data.snr = data.eeg.data.snr;
              }
              continue;
            }
            
            // Handle time series data
            if (Array.isArray(data.eeg.data[channel])) {
              // Add to incoming buffer instead of directly to data array
              buffer.incoming[channel].push(...data.eeg.data[channel]);
            }
          }
        }
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Error updating EEG data:', err);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Stop mock data generation
    if (this.dataUpdateInterval) {
      clearInterval(this.dataUpdateInterval);
      this.dataUpdateInterval = null;
    }

  }
}
