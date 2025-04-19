<template>
  <div class="usb-page">
    <div class="usb-container">
      
      <div class="usb-actions">
        <button @click="detectUSBDevices" :disabled="isScanning">
          {{ isScanning ? $t('usb.actions.detecting') : $t('usb.actions.detect') }}
        </button>
      </div>
      
      <div v-if="error" class="error-message">{{ error }}</div>
      
      <div class="devices-section">
        <h2>{{ $t('usb.devices.title') }}</h2>
        <div v-if="devices.length === 0" class="no-devices">
          {{ $t('usb.devices.empty') }}
        </div>
        <ul v-else class="device-list">
          <li v-for="(device, index) in devices" 
              :key="device.path" 
              :class="{ 'selected': selectedDevice === device.path }"
              @click="selectDevice(device.path, index)">
            <div class="device-info">
              <div class="device-name">{{ device.name }}</div>
              <div class="device-path">{{ device.path }}</div>
              <div class="device-mount" :class="{ 'not-mounted': !device.isMounted }">
                {{ device.isMounted ? 
                  `${$t('usb.devices.device.mounted')}: ${device.mountPoint}` : 
                  $t('usb.devices.device.notMounted') }}
              </div>
            </div>
          </li>
        </ul>
        
        <div v-if="devices.length > 0" class="device-notes">
          <p v-if="hasUnmountedDevices" class="mount-warning">
            {{ $t('usb.devices.mountWarning') }}
          </p>
          <button @click="showDeviceHelp" class="help-button">
            {{ $t('usb.devices.help') }}
          </button>
        </div>
      </div>
      
      <div class="device-details" v-if="selectedDevice">
        <h2>{{ $t('usb.details.title') }}</h2>
        <div class="space-info">
          <div class="space-progress">
            <div class="space-bar" :style="{ width: spacePercentage + '%' }"></div>
          </div>
          <div class="space-text">
            {{ formatSpace(availableSpace) }} {{ $t('usb.details.space') }} {{ formatSpace(totalSpace) }}
          </div>
        </div>
        
        <div class="operations">
          <h3>{{ $t('usb.database.title') }}</h3>
          <div class="backup-section">
            <div class="status-message" v-if="dbStatus">
              {{ dbStatus }}
            </div>
            <button @click="backupDatabase" :disabled="!selectedDevice || !dbExists">
              {{ dbExists ? $t('usb.database.backup') : $t('usb.database.notFound') }}
            </button>
          </div>
          
          <h3>{{ $t('usb.firmware.title') }}</h3>
          <div class="firmware-section">
            <input 
              type="file" 
              ref="firmwareUpload" 
              accept=".bin" 
              @change="handleFileUpload" 
              style="display: none"
            />
            <button @click="triggerFileUpload" :disabled="!selectedDevice">
              {{ $t('usb.firmware.select') }}
            </button>
            <div class="selected-file" v-if="selectedFile">
              {{ $t('usb.firmware.selected') }} {{ selectedFile.name }} ({{ formatSpace(selectedFile.size) }})
            </div>
            <button 
              v-if="selectedFile" 
              @click="uploadFirmware" 
              :disabled="!selectedDevice || isUploading"
            >
              {{ isUploading ? $t('usb.firmware.uploading') : $t('usb.firmware.upload') }}
            </button>
            <div class="status-message" v-if="uploadStatus">
              {{ uploadStatus }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useUsbStore } from '../stores/usbStore';
import logger from '../utils/logger';

export default {
  name: 'USBView',
  
  data() {
    return {
      dbExists: false,
      dbStatus: '',
      selectedFile: null,
      isUploading: false,
      uploadStatus: ''
    }
  },
  
  computed: {
    // Map store properties to component
    devices() {
      return this.usbStore.devices;
    },
    
    isScanning() {
      return this.usbStore.isScanning;
    },
    
    selectedDevice() {
      return this.usbStore.selectedDevice;
    },
    
    error() {
      return this.usbStore.error;
    },
    
    availableSpace() {
      return this.usbStore.availableSpace;
    },
    
    totalSpace() {
      return this.usbStore.totalSpace;
    },
    
    spacePercentage() {
      if (this.totalSpace === 0) return 0;
      const used = this.totalSpace - this.availableSpace;
      return Math.round((used / this.totalSpace) * 100);
    },
    
    hasUnmountedDevices() {
      return this.devices.some(device => !device.isMounted);
    }
  },
  
  created() {
    this.usbStore = useUsbStore();
    
    // Add handler for store data updates from C++ backend
    if (window.bellaBridge && !window.bellaBridge.handlers.updateUsbDevices) {
      window.bellaBridge.handlers.updateUsbDevices = (deviceArray) => {
        logger.info('Received USB device list from C++ backend');
        this.usbStore.updateDevices(deviceArray);
        return { success: true };
      };
      
      window.bellaBridge.handlers.updateUsbSpaceInfo = (availableSpace, totalSpace) => {
        logger.info('Received USB space information from C++ backend');
        this.usbStore.updateSpaceInfo(availableSpace, totalSpace);
        return { success: true };
      };
      
      window.bellaBridge.handlers.receiveDbStatus = (exists, message) => {
        logger.info('Received database status from C++ backend');
        this.dbExists = exists;
        this.dbStatus = message;
        return { success: true };
      };
      
      window.bellaBridge.handlers.receiveFirmwareUploadStatus = (success, message) => {
        logger.info('Received firmware upload status from C++ backend');
        this.uploadStatus = message;
        this.isUploading = false;
        if (success) {
          this.selectedFile = null;
        }
        return { success: true };
      };
    }
    
    // Detect USB devices on page load
    this.detectUSBDevices();
  },
  
  methods: {
    detectUSBDevices() {
      logger.info('Detecting USB storage devices');
      this.usbStore.detectDevices();
      // Also check if database exists
      this.checkDatabaseExists();
    },
    
    selectDevice(devicePath, index) {
      logger.info('Selecting USB device: ' + devicePath);
      this.usbStore.selectDevice(devicePath, index);
      this.uploadStatus = '';
      this.dbStatus = '';
    },
    
    formatSpace(bytes) {
      if (bytes < 1024) return bytes + ' B';
      else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
      else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
      else return (bytes / 1073741824).toFixed(2) + ' GB';
    },
    
    checkDatabaseExists() {
      logger.info('Checking if database file exists');
      return window.bellaBridge.calls.cppBackend('device', {
        function: "usb",
        operation: "checkdb"
      });
    },
    
    backupDatabase() {
      if (!this.selectedDevice) {
        this.error = this.$t('usb.errors.noDeviceSelected');
        return;
      }
      
      // Check if device is mounted
      const device = this.devices.find(d => d.path === this.selectedDevice);
      if (device && !device.isMounted) {
        this.dbStatus = this.$t('usb.errors.deviceNotMounted');
        return;
      }
      
      logger.info('Backing up database to USB device');
      this.dbStatus = this.$t('usb.database.backingUp');
      
      return window.bellaBridge.calls.cppBackend('device', {
        function: "usb",
        operation: "backup",
        deviceIndex: this.usbStore.deviceIndex
      });
    },
    
    triggerFileUpload() {
      this.$refs.firmwareUpload.click();
    },
    
    handleFileUpload(event) {
      const files = event.target.files;
      if (files.length === 0) return;
      
      const file = files[0];
      if (!file.name.endsWith('.bin')) {
        this.uploadStatus = 'Error: Only .bin files are allowed';
        return;
      }
      
      this.selectedFile = file;
      this.uploadStatus = '';
      logger.info(`Selected firmware file: ${file.name} (${file.size} bytes)`);
    },
    
    uploadFirmware() {
      if (!this.selectedDevice || !this.selectedFile) {
        return;
      }
      
      logger.info(`Uploading firmware file: ${this.selectedFile.name}`);
      this.isUploading = true;
      this.uploadStatus = 'Uploading firmware...';
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target.result;
        
        return window.bellaBridge.calls.cppBackend('device', {
          function: "usb",
          operation: "uploadfirmware",
          deviceIndex: this.usbStore.deviceIndex,
          filename: this.selectedFile.name,
          data: fileContent
        });
      };
      
      reader.onerror = (e) => {
        this.uploadStatus = 'Error reading file';
        this.isUploading = false;
        logger.error(`Error reading file: ${e}`);
      };
      
      reader.readAsArrayBuffer(this.selectedFile);
    },
    
    showDeviceHelp() {
      this.dbStatus = this.$t('usb.devices.helpText');
    }
  }
}
</script>

<style scoped>
.usb-page {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.usb-container {
  padding: 20px;
  font-family: 'Noto Sans', sans-serif;
}

.usb-actions {
  margin-bottom: 20px;
}

button {
  padding: 8px 16px;
  background-color: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
  margin-bottom: 10px;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: #e53935;
  padding: 10px;
  margin-bottom: 15px;
  background-color: rgba(229, 57, 53, 0.1);
  border-left: 4px solid #e53935;
}

.devices-section {
  margin-bottom: 20px;
}

.no-devices {
  font-style: italic;
  color: #666;
}

.device-list {
  list-style: none;
  padding: 0;
}

.device-list li {
  padding: 12px;
  border: 1px solid #ddd;
  margin-bottom: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.device-list li:hover {
  background-color: #f5f5f5;
}

.device-list li.selected {
  background-color: #e3f2fd;
  border-color: #4a90e2;
}

.device-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.device-path {
  font-size: 0.9em;
  color: #666;
}

.device-mount {
  font-size: 0.9em;
  color: #388e3c;
  margin-top: 5px;
}

.device-mount.not-mounted {
  color: #e53935;
}

.device-notes {
  margin-top: 15px;
  font-size: 0.9em;
}

.mount-warning {
  color: #e53935;
  margin-bottom: 10px;
}

.help-button {
  background-color: #f5f5f5;
  color: #333;
  font-size: 0.8em;
  padding: 5px 10px;
}

.device-details {
  margin-top: 30px;
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.space-info {
  margin-bottom: 20px;
}

.space-progress {
  height: 20px;
  background-color: #f5f5f5;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 5px;
}

.space-bar {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s;
}

.space-text {
  font-size: 0.9em;
  text-align: right;
}

.operations {
  margin-top: 20px;
}

.backup-section,
.firmware-section {
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 20px;
}

.status-message {
  padding: 8px;
  margin: 10px 0;
  background-color: #e8f5e9;
  border-left: 4px solid #4caf50;
  font-size: 0.9em;
}

.selected-file {
  margin: 10px 0;
  padding: 5px 10px;
  background-color: #e3f2fd;
  border-radius: 4px;
  font-size: 0.9em;
}
</style>