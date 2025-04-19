import { defineStore } from 'pinia';
import logger from '../utils/logger.js';

/**
 * Store to manage ESP32 system status data
 */
export const useEspStore = defineStore('esp', {
  state: () => ({
    systemStatus: {
      heap_size: 0,
      min_heap: 0,
      heap_min: 0, // Added to support new naming format
      psram_size: 0,
      free_psram: 0,
      psram_free: 0, // Added to support new naming format
      flash_size: 0,
      wifi_status: "unknown",
      wifi_rssi: "", // Added to support new format
      bluetooth_status: "unknown",
      uptime: 0,
      lastUpdate: null
    },
    diagnosisInfo: {
      diagnosis_id: 0,
      diagnosis_stage: 0
    },
    deviceInfo: {
      valen_id: "unknown",
      bella_id: "unknown",
    },
    isConnected: false,
    connectionHistory: [],
    error: null
  }),
  
  getters: {
    heapUsagePercent: (state) => {
      if (!state.systemStatus.heap_size) return 0;
      
      // Use min_heap or heap_min depending on which is available
      const minHeap = state.systemStatus.min_heap || state.systemStatus.heap_min || 0;
      return 100 - ((minHeap / state.systemStatus.heap_size) * 100);
    },
    
    psramUsagePercent: (state) => {
      if (!state.systemStatus.psram_size) return 0;
      
      // Use free_psram or psram_free depending on which is available
      const freePsram = state.systemStatus.free_psram || state.systemStatus.psram_free || 0;
      return 100 - ((freePsram / state.systemStatus.psram_size) * 100);
    },
    
    wifiConnected: (state) => {
      return state.systemStatus.wifi_status?.toLowerCase().includes('connected');
    },
    
    // Add a getter for Bluetooth connection status
    bluetoothConnected: (state) => {
      return state.systemStatus.bluetooth_status?.toLowerCase().includes('active') || 
             state.systemStatus.bluetooth_status?.toLowerCase().includes('connected');
    },
    
    wifiSignalStrength: (state) => {
      try {
        if (!state.wifiConnected) return 0;
        
        // First check if we have the wifi_rssi field (new format)
        if (state.systemStatus.wifi_rssi) {
          // wifi_rssi can be a string with a negative number like "-45" or a number
          let rssi;
          if (typeof state.systemStatus.wifi_rssi === 'string') {
            rssi = parseInt(state.systemStatus.wifi_rssi.replace(/['"]+/g, ''), 10);
          } else {
            rssi = state.systemStatus.wifi_rssi;
          }
          
          if (!isNaN(rssi)) {
            // Normalize RSSI to percentage (typically -90 to -30 dBm range)
            const percentage = Math.min(100, Math.max(0, ((rssi + 90) / 60) * 100));
            return Math.round(percentage);
          }
        }
        
        // Extract RSSI value from wifi_status if it contains one (old format)
        const rssiMatch = state.systemStatus.wifi_status.match(/RSSI:\s*(-?\d+)/i);
        if (rssiMatch && rssiMatch[1]) {
          const rssi = parseInt(rssiMatch[1], 10);
          
          // Normalize RSSI to percentage (typically -90 to -30 dBm range)
          const percentage = Math.min(100, Math.max(0, ((rssi + 90) / 60) * 100));
          return Math.round(percentage);
        }
        
        // If ESP has a dedicated signal_strength_percent value, use that
        if (state.systemStatus.signal_strength_percent !== undefined) {
          return state.systemStatus.signal_strength_percent;
        }
      } catch (err) {
        logger.error(`Error calculating WiFi signal strength: ${err.message}`);
      }
      
      return 0;
    },
    
    uptimeFormatted: (state) => {
      const uptime = state.systemStatus.uptime || 0;
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = uptime % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    },
    
    lastUpdateFormatted: (state) => {
      if (!state.systemStatus.lastUpdate) return 'Never';
      
      try {
        const now = new Date();
        const lastUpdate = new Date(state.systemStatus.lastUpdate);
        const diffMs = now - lastUpdate;
        
        // If less than 60 seconds ago
        if (diffMs < 60000) {
          return 'Just now';
        }
        
        // If less than an hour ago
        if (diffMs < 3600000) {
          const minutes = Math.floor(diffMs / 60000);
          return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
        
        // Otherwise format the date/time
        return lastUpdate.toLocaleTimeString();
      } catch (err) {
        logger.error(`Error formatting last update time: ${err.message}`);
        return 'Unknown';
      }
    }
  },
  
  actions: {
    /**
     * Update system status from ESP32 data
     */
    updateSystemStatus(data) {
      try {
        if (!data) {
          logger.warn('Received empty ESP32 data');
          return false;
        }
        
        // Update ESP32 system data - handle the direct format from backend without processing
        if (data.esp32) {
          this.systemStatus = {
            ...this.systemStatus,
            ...data.esp32,
            lastUpdate: new Date()
          };
          
          // Log specific bluetooth status updates for debugging
          if (data.esp32.bluetooth_status) {
            logger.debug(`Bluetooth status updated: ${data.esp32.bluetooth_status}`);
            
            // Emit a dedicated event for bluetooth status changes
            if (window.eventBus) {
              window.eventBus.emit('bluetooth-status-change', this.bluetoothConnected);
            }
          }
        }
        
        // Update header information if available
        if (data.header) {
          // Handle valen device info
          if (data.header.valen && data.header.valen.id) {
            this.deviceInfo.valen_id = data.header.valen.id;
          }
          
          // Handle bella device info
          if (data.header.bella && data.header.bella.id) {
            this.deviceInfo.bella_id = data.header.bella.id;
          }
          
          // Handle diagnosis info if present
          if (data.header.diagnosis) {
            if (data.header.diagnosis.id !== undefined) {
              this.diagnosisInfo.diagnosis_id = data.header.diagnosis.id;
            }
            
            if (data.header.diagnosis.stage !== undefined) {
              this.diagnosisInfo.diagnosis_stage = data.header.diagnosis.stage;
            }
          }
        }
        
        // Update connection state based on data being received
        if (!this.isConnected) {
          this.isConnected = true;
          this.connectionHistory.push({
            time: new Date(),
            action: 'connected'
          });
        }
        
        // If there was an error previously, clear it now
        if (this.error) {
          this.error = null;
        }
        
        // Emit event for any components that want to listen
        if (window.eventBus) {
          window.eventBus.emit('esp-updated', this.systemStatus);
          
          // Also emit a WiFi status change event for improved reactivity
          window.eventBus.emit('wifi-status-change', this.wifiConnected);
        }
        
        return true;
      } catch (error) {
        logger.error(`Error updating ESP32 system status: ${error.message}`);
        this.error = error.message;
        return false;
      }
    },
    
    /**
     * Record connection loss
     */
    recordConnectionLoss(reason = 'timeout') {
      this.isConnected = false;
      this.connectionHistory.push({
        time: new Date(),
        action: 'disconnected',
        reason: reason
      });
      
      // Keep connection history from growing too large
      if (this.connectionHistory.length > 50) {
        this.connectionHistory = this.connectionHistory.slice(-50);
      }
    }
  }
});