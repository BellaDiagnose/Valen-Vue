<template>
  <div class="bluetooth-page">
    <div class="bluetooth-container">
      <div class="controls">
        <button 
          class="scan-button" 
          @click="startScan" 
          :disabled="isScanning || connectionStatus === 'connecting'">
          {{ isScanning ? $t('bluetooth.scanning') : $t('bluetooth.scanButton') }}
        </button>
        
        <span class="status-label" v-if="connectionStatus !== 'disconnected'">
          Status: {{ connectionStatusDisplay }}
        </span>
      </div>
      
      <div class="tabs">
        <button 
          class="tab-button"
          :class="{ active: activeTab === 'discovered' }"
          @click="bluetoothStore.setActiveTab('discovered')"
        >
          {{ $t('bluetooth.tabs.discovered') }}
        </button>
        <button 
          class="tab-button"
          :class="{ active: activeTab === 'paired' }"
          @click="showPairedDevices"
        >
          {{ $t('bluetooth.tabs.paired') }}
        </button>
      </div>

      <!-- Show discovered devices -->
      <div class="device-list" v-if="activeTab === 'discovered'">
        <div v-if="isScanning" class="scanning-message">
          <span class="scanning-spinner"></span>
          {{ $t('bluetooth.scanning') }}
        </div>
        
        <div v-else-if="devices.length === 0" class="no-devices">
          {{ $t('bluetooth.noDevices') }}
        </div>
        
        <div 
          v-for="device in devices" 
          :key="device.address"
          class="device-item"
          :class="{ 'selected': selectedDevice === device.address, 'connected': device.connected }"
        >
          <div class="device-info">
            <div class="device-name">{{ device.name || $t('bluetooth.deviceTypes.unknown') }}</div>
            <div class="device-address">{{ device.address }}</div>
            <div class="device-type">
              {{ getDeviceTypeLabel(device.type) }}
              <span v-if="device.paired" class="paired-badge">{{ $t('bluetooth.badges.paired') }}</span>
              <span v-if="device.connected" class="connected-badge">{{ $t('bluetooth.badges.connected') }}</span>
            </div>
          </div>
          
          <div class="device-actions">
            <button 
              v-if="!device.connected" 
              class="connect-button"
              @click="device.paired ? connectToDevice(device.address) : pairDevice(device.address)"
              :disabled="connectionStatus === 'connecting' || connectionStatus === 'pairing'"
            >
              {{ device.paired ? $t('bluetooth.actions.connect') : $t('bluetooth.actions.pair') }}
            </button>
            <button 
              v-else 
              class="disconnect-button"
              @click="disconnectDevice(device.address)"
            >
              {{ $t('bluetooth.actions.disconnect') }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Show paired devices -->
      <div class="device-list" v-if="activeTab === 'paired'">
        <div v-if="pairedDevices.length === 0" class="no-devices">
          {{ $t('bluetooth.noDevices') }}
        </div>
        
        <div 
          v-for="device in pairedDevices" 
          :key="device.address"
          class="device-item"
          :class="{ 'selected': selectedDevice === device.address, 'connected': device.connected }"
        >
          <div class="device-info">
            <div class="device-name">{{ device.name || $t('bluetooth.deviceTypes.unknown') }}</div>
            <div class="device-address">{{ device.address }}</div>
            <div class="device-type">
              {{ getDeviceTypeLabel(device.type) }}
              <span v-if="device.connected" class="connected-badge">{{ $t('bluetooth.badges.connected') }}</span>
            </div>
          </div>
          
          <div class="device-actions">
            <button 
              v-if="!device.connected" 
              class="connect-button"
              @click="device.paired ? connectToDevice(device.address) : pairDevice(device.address)"
              :disabled="connectionStatus === 'connecting' || connectionStatus === 'pairing'"
            >
              {{ device.paired ? $t('bluetooth.actions.connect') : $t('bluetooth.actions.pair') }}
            </button>
            <button 
              v-else 
              class="disconnect-button"
              @click="disconnectDevice(device.address)"
            >
              {{ $t('bluetooth.actions.disconnect') }}
            </button>
            <button @click="handleUnpair(device.address)" class="unpair-button">
              {{ $t('bluetooth.actions.unpair') }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- PIN entry dialog -->
      <div class="pin-dialog" v-if="showPinDialog">
        <div class="pin-dialog-content">
          <h3>{{ $t('bluetooth.pin.title') }}</h3>
          <p>{{ $t('bluetooth.pin.instruction') }}</p>
          <input 
            type="text" 
            v-model="pinCode" 
            class="pin-input" 
            :placeholder="$t('bluetooth.pin.placeholder')"
            maxlength="6"
          />
          <div class="pin-actions">
            <button @click="cancelPairing" class="cancel-button">{{ $t('bluetooth.pin.cancel') }}</button>
            <button @click="confirmPairing" class="confirm-button">{{ $t('bluetooth.pin.confirm') }}</button>
          </div>
        </div>
      </div>
      
      <div v-if="error" class="error-message">
        {{ $t('common.error') }}: {{ error }}
      </div>
    </div>
  </div>
</template>

<script>
import { useBluetoothStore } from '../stores/bluetoothStore.js'
import logger from '../utils/logger.js'
import { useI18n } from 'vue-i18n'

export default {
  name: 'BluetoothView',
  
  setup() {
    const { t } = useI18n()
    const bluetoothStore = useBluetoothStore()
    const handleUnpair = (address) => {
      bluetoothStore.unpairDevice(address)
        .then(() => {
          console.info(`Device ${address} unpaired successfully`)
        })
        .catch(err => {
          console.error(`Unpair failed for ${address}:`, err)
        })
    }
    return { t, bluetoothStore, handleUnpair }
  },
  
  data() {
    return {
      showPinDialog: false,
      pinCode: '',
      deviceToPair: null
    }
  },
  
  computed: {
    bluetoothStore() {
      return useBluetoothStore()
    },
    
    devices() {
      return this.bluetoothStore.devices
    },
    
    pairedDevices() {
      return this.bluetoothStore.pairedDevices
    },
    
    isScanning() {
      return this.bluetoothStore.isScanning
    },
    
    // Use the activeTab from the store instead of local state
    activeTab() {
      return this.bluetoothStore.activeTab
    },
    
    connectionStatus() {
      return this.bluetoothStore.connectionStatus
    },
    
    connectionStatusDisplay() {
      // Use i18n for status messages
      return this.$t(`bluetooth.status.${this.connectionStatus}`);
    },
    
    selectedDevice() {
      return this.bluetoothStore.selectedDevice
    },
    
    error() {
      return this.bluetoothStore.error
    }
  },
  
  mounted() {
    // Register window-level handler for PIN request if bellaBridge exists
    if (window.bellaBridge && !window.bellaBridge.handlers.requestBluetoothPin) {
      window.bellaBridge.handlers.requestBluetoothPin = (deviceId, deviceName) => {
        logger.info({
          title: 'Bluetooth PIN',
          message: `PIN requested for device: ${deviceName || deviceId}`
        })
        
        this.deviceToPair = deviceId;
        this.showPinDialog = true;
        
        // Return success so C++ knows we've handled the request
        return { success: true };
      };
    }
    
    // Attempt to get any paired devices when component is mounted
    this.showPairedDevices();
  },
  
  methods: {
    startScan() {
      this.bluetoothStore.startScan()
    },
    
    showPairedDevices() {
      this.bluetoothStore.setActiveTab('paired');
      this.bluetoothStore.getPairedDevices();
    },
    
    getDeviceTypeLabel(type) {
      // Map device type numbers to i18n keys
      const typeKeys = {
        '1': 'audio',
        '2': 'input',
        '3': 'phone',
        '4': 'computer'
      };
      
      const key = typeKeys[type] || 'unknown';
      return this.$t(`bluetooth.deviceTypes.${key}`);
    },
    

    pairDevice(deviceId, pin = '', connectAfterPairing = true) {
      return this.bluetoothStore.pairDevice(deviceId, pin, connectAfterPairing);
    },
    
    connectToDevice(deviceId) {
      return this.bluetoothStore.connectToDevice(deviceId);
    },
    
    disconnectDevice(deviceId) {
      logger.info({
        title: 'Bluetooth UI',
        message: `User disconnecting from device: ${deviceId}`
      });
      
      this.bluetoothStore.disconnectDevice(deviceId);
    },
    
    confirmPairing() {
      if (this.deviceToPair) {
        logger.info({
          title: 'Bluetooth UI',
          message: `Confirming pairing with PIN for device: ${this.deviceToPair}`
        });
        
        // Use the dedicated pairDevice method with the PIN
        this.pairDevice(this.deviceToPair, this.pinCode);
        
        // Reset PIN dialog
        this.showPinDialog = false;
        this.pinCode = '';
        this.deviceToPair = null;
      }
    },
    
    cancelPairing() {
      logger.info({
        title: 'Bluetooth UI',
        message: 'User cancelled PIN entry'
      });
      
      // Reset PIN dialog
      this.showPinDialog = false;
      this.pinCode = '';
      this.deviceToPair = null;
    }
  }
}
</script>

<style scoped>
.bluetooth-page {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.bluetooth-container {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.header {
  margin-bottom: 20px;
}

.controls {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.status-label {
  margin-left: 15px;
  font-style: italic;
}

.scan-button {
  padding: 10px 20px;
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.scan-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.tabs {
  margin-bottom: 20px;
  display: flex;
  border-bottom: 1px solid #dee2e6;
}

.tab-button {
  padding: 10px 20px;
  background-color: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  margin-right: 10px;
  font-size: 16px;
}

.tab-button.active {
  border-bottom-color: #007bff;
  color: #007bff;
  font-weight: bold;
}

.device-list {
  margin-top: 20px;
}

.scanning-message {
  padding: 15px;
  text-align: center;
  color: #6c757d;
}

.scanning-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(0, 123, 255, 0.3);
  border-radius: 50%;
  border-top-color: #007bff;
  animation: spin 1s ease-in-out infinite;
  margin-right: 10px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.no-devices {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.device-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 1px solid #ddd;
  margin-bottom: 10px;
  border-radius: 4px;
  background-color: #f8f9fa;
}

.device-item.selected {
  border: 2px solid #007bff;
}

.device-item.connected {
  background-color: #e7f4ff;
}

.device-info {
  flex: 1;
}

.device-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.device-address {
  color: #6c757d;
  font-size: 0.9em;
  margin-bottom: 5px;
}

.device-type {
  color: #495057;
  font-size: 0.9em;
  display: flex;
  align-items: center;
}

.paired-badge, .connected-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.8em;
  margin-left: 8px;
}

.paired-badge {
  background-color: #ffc107;
  color: #212529;
}

.connected-badge {
  background-color: #28a745;
  color: white;
}

.device-actions {
  margin-left: 15px;
}

.connect-button {
  padding: 8px 15px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.disconnect-button {
  padding: 8px 15px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.unpair-button {
  padding: 8px 15px;
  background-color: #ffc107;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.connect-button:disabled, .disconnect-button:disabled, .unpair-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.error-message {
  color: #dc3545;
  margin-top: 20px;
  padding: 10px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}

/* PIN entry dialog */
.pin-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; /* Increased z-index to appear above navigation */
}

.pin-dialog-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
}

.pin-input {
  width: 100%;
  padding: 10px;
  margin: 10px 0 20px;
  font-size: 16px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  text-align: center;
}

.pin-actions {
  display: flex;
  justify-content: space-between;
}

.cancel-button {
  padding: 8px 15px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-button {
  padding: 8px 15px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>