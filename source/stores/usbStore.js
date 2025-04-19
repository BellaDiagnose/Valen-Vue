import { defineStore } from 'pinia'
import logger from '../utils/logger.js'

export const useUsbStore = defineStore('usb', {
  state: () => ({
    isScanning: false,
    devices: [],
    selectedDevice: null,
    deviceIndex: 0,
    error: null,
    availableSpace: 0,
    totalSpace: 0,
    databaseExists: false,
    databaseStatus: '',
    firmwareUploadStatus: '',
    firmwareUploadSuccess: false,
    fileOperationStatus: '',
    fileOperationSuccess: false
  }),
  
  actions: {
    // Called when new USB storage devices are discovered
    updateDevices(deviceArray) {
      this.devices = deviceArray;
      this.isScanning = false;
      
      // Reset selected device if it's no longer available
      if (this.selectedDevice && !deviceArray.some(device => device.path === this.selectedDevice)) {
        this.selectedDevice = null;
        this.deviceIndex = 0;
      }
      
      logger.info({
        title: 'USB Storage',
        message: `Updated device list with ${deviceArray.length} devices`
      });
      return true;
    },
    
    // Start a scan for USB devices
    detectDevices() {
      this.isScanning = true;
      this.error = null;
      
      logger.info({
        title: 'USB Storage',
        message: 'Detecting USB storage devices'
      });
      
      // Call C++ backend via bellaBridge
      return window.bellaBridge.calls.cppBackend('device', {
        function: "usb",
        operation: "scan"
      });
    },
    
    // Select a USB device
    selectDevice(devicePath, index) {
      this.selectedDevice = devicePath;
      this.deviceIndex = index;
      this.error = null;
      
      logger.info({
        title: 'USB Storage',
        message: `Selected USB device: ${devicePath}`
      });
      
      // Get space information for the selected device
      return window.bellaBridge.calls.cppBackend('device', {
        function: "usb",
        operation: "info",
        deviceIndex: index
      });
    },
    
    // Check if database exists in resources/data folder
    checkDatabase() {
      this.error = null;
      
      logger.info({
        title: 'USB Storage',
        message: 'Checking database existence'
      });
      
      // Call C++ backend via bellaBridge
      return window.bellaBridge.calls.cppBackend('device', {
        function: "usb",
        operation: "checkdb"
      });
    },
    
    // Update database status
    updateDatabaseStatus(exists, statusMessage) {
      this.databaseExists = exists;
      this.databaseStatus = statusMessage;
      
      logger.info({
        title: 'USB Storage',
        message: `Database status: ${statusMessage}`
      });
      
      return true;
    },
    
    // Update space information
    updateSpaceInfo(availableSpace, totalSpace) {
      this.availableSpace = availableSpace;
      this.totalSpace = totalSpace;
      
      logger.info({
        title: 'USB Storage',
        message: `Space info updated: ${(availableSpace / (1024 * 1024 * 1024)).toFixed(2)}GB free of ${(totalSpace / (1024 * 1024 * 1024)).toFixed(2)}GB`
      });
      
      return true;
    },
    
    // Backup database to USB device
    backupDatabase() {
      if (!this.selectedDevice) {
        this.error = "No USB device selected";
        return false;
      }
      
      logger.info({
        title: 'USB Storage',
        message: `Backing up database to USB device`
      });
      
      // Call C++ backend via bellaBridge
      return window.bellaBridge.calls.cppBackend('device', {
        function: "usb",
        operation: "backup",
        deviceIndex: this.deviceIndex
      });
    },
    
    // Upload firmware file from USB
    uploadFirmware(filename, data) {
      if (!this.selectedDevice) {
        this.error = "No USB device selected";
        return false;
      }
      
      if (!filename.toLowerCase().endsWith('.bin')) {
        this.error = "Only .bin files are allowed for firmware";
        return false;
      }
      
      logger.info({
        title: 'USB Storage',
        message: `Uploading firmware file to system: ${filename}`
      });
      
      // Call C++ backend via bellaBridge
      return window.bellaBridge.calls.cppBackend('device', {
        function: "usb",
        operation: "uploadfirmware",
        deviceIndex: this.deviceIndex,
        filename: filename,
        data: data
      });
    },
    
    // Update firmware upload status
    updateFirmwareStatus(success, message) {
      this.firmwareUploadSuccess = success;
      this.firmwareUploadStatus = message;
      
      logger.info({
        title: 'USB Storage',
        message: `Firmware upload status: ${message}`
      });
      
      return true;
    },
    
    // Update file operation status
    updateFileOperationStatus(success, message) {
      this.fileOperationSuccess = success;
      this.fileOperationStatus = message;
      
      logger.info({
        title: 'USB Storage',
        message: `File operation status: ${message}`
      });
      
      return true;
    }
  }
})