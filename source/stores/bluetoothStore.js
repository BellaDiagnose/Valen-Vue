import { defineStore } from 'pinia'
import logger from '../utils/logger.js'

export const useBluetoothStore = defineStore('bluetooth', {
  state: () => ({
    isScanning: false,
    devices: [],
    pairedDevices: [],
    selectedDevice: null,
    connectionStatus: 'disconnected', // 'disconnected', 'connecting', 'connected', 'pairing', 'error'
    error: null,
    isPairing: false,
    pinRequired: false,
    activeTab: 'paired' // Track the active tab: 'paired' or 'discovered'
  }),
  
  getters: {
    // Get all audio devices (earPods, headphones, speakers)
    audioDevices() {
      return this.devices.filter(device => device.type === "1") // Type 1 = AUDIO
    },
    
    // Get connected audio device (if any)
    connectedAudioDevice() {
      return this.devices.find(device => device.type === "1" && device.connected)
    },
    
    // Get paired audio devices
    pairedAudioDevices() {
      return this.pairedDevices.filter(device => device.type === "1")
    },
    
    // Check if we have any connected device
    hasConnectedDevice() {
      return this.devices.some(device => device.connected)
    }
  },
  
  actions: {
    // Called when new Bluetooth devices are discovered
    updateDevices(deviceArray) {
      this.devices = deviceArray;
      this.isScanning = false;
      
      // Switch to discovered devices tab when scan completes
      this.setActiveTab('discovered');
      
      // Add debug logging for device types
      const audioDevices = deviceArray.filter(d => d.type === "1");
      logger.info({
        title: 'Bluetooth',
        message: `Updated device list with ${deviceArray.length} devices (${audioDevices.length} audio devices)`
      });
      
      // Log all devices with their types for debugging
      deviceArray.forEach(device => {
        logger.debug({
          title: 'Bluetooth Device',
          message: `${device.name} (${device.address}) - Type: ${device.type} ${device.type === "1" ? "[AUDIO]" : ""}`
        });
      });
      
      return true;
    },
    
    // Update the list of paired devices
    updatePairedDevices(deviceArray) {
      this.pairedDevices = deviceArray;
      logger.info({
        title: 'Bluetooth',
        message: `Updated paired devices list with ${deviceArray.length} devices`
      });
      return true;
    },
    
    // Start a scan for Bluetooth devices
    startScan() {
      this.isScanning = true;
      this.error = null;
      this.devices = [];
      
      // Switch to discovered devices tab immediately when scan starts
      this.setActiveTab('discovered');
      
      logger.info({
        title: 'Bluetooth',
        message: 'Starting Bluetooth device scan'
      });
      
      // Call C++ backend via bellaBridge
      return window.bellaBridge.calls.cppBackend('device', {
        function: "bluetooth",
        operation: "scan"
      });
    },
    
    // Set the active tab
    setActiveTab(tab) {
      if (tab === 'paired' || tab === 'discovered') {
        this.activeTab = tab;
        logger.debug({
          title: 'Bluetooth UI',
          message: `Switched to ${tab} tab`
        });
      }
    },
    
    // Get list of already paired devices
    getPairedDevices() {
      logger.info({
        title: 'Bluetooth',
        message: 'Retrieving paired devices'
      });
      
      // Call C++ backend via bellaBridge
      return window.bellaBridge.calls.cppBackend('device', {
        function: "bluetooth",
        operation: "paired"
      });
    },
    
    // Connect to a specific device
    connectToDevice(address) {
      if (!address) {
        logger.error({
          title: 'Bluetooth',
          message: 'No device address provided for connection'
        });
        return Promise.reject(new Error('No device address provided'));
      }
      
      // Update UI state
      this.connectionStatus = 'connecting';
      this.selectedDevice = address;
      this.error = null;
      
      logger.info({
        title: 'Bluetooth',
        message: `Connecting to device: ${address}`
      });
      
      // Call C++ backend via bellaBridge
      try {
        window.bellaBridge.calls.cppBackend('device', {
          function: 'bluetooth',
          operation: 'connect',
          address: address
        });
        
        logger.debug({
          title: 'Bluetooth',
          message: `Connect request sent for device: ${address}`
        });
        return Promise.resolve();
      } catch (error) {
        logger.error({
          title: 'Bluetooth Error',
          message: `Failed to connect: ${error}`
        });
        this.setError(`Connection failed: ${error}`);
        return Promise.reject(error);
      }
    },
    
    // Pair with a device
    pairDevice(address, pin = '', connectAfterPairing = true) {
      if (!address) {
        logger.error({
          title: 'Bluetooth',
          message: 'No device address provided for pairing'
        });
        return Promise.reject(new Error('No device address provided'));
      }
      
      // Update UI state
      this.connectionStatus = 'pairing';
      this.selectedDevice = address;
      this.error = null;
      this.isPairing = true;
      
      logger.info({
        title: 'Bluetooth',
        message: `Pairing with device: ${address}${pin ? ' (with PIN)' : ''}`
      });
      
      // Create parameters object
      const params = {
        function: 'bluetooth',
        operation: 'pair',
        address: address,
        connect: connectAfterPairing
      };
      
      // Add PIN if provided
      if (pin && pin.trim()) {
        params.pin = pin.trim();
      }
      
      // For audio devices (type 1), we might need to handle PIN entry
      const audioDevice = this.devices.find(d => d.address === address && d.type === "1");
      if (audioDevice && !pin) {
        logger.info({
          title: 'Bluetooth',
          message: `Attempting to pair with audio device: ${audioDevice.name}`
        });
      }
      
      try {
        // Call C++ backend via bellaBridge
        const promise = window.bellaBridge.calls.cppBackend('device', params);
        
        // Handle the result if it's a Promise
        if (promise && typeof promise.then === 'function') {
          return promise.then(() => {
            logger.debug({
              title: 'Bluetooth',
              message: `Pair request sent for device: ${address}`
            });
            
            // Wait for a bit to see if pairing succeeds
            return new Promise((resolve, reject) => {
              // Allow some time for pairing to complete
              const timeoutMs = 12000; // 12 seconds timeout
              const checkInterval = 1000; // Check every second
              let elapsed = 0;
              
              const checkPairingStatus = () => {
                if (this.connectionStatus === 'connected') {
                  clearInterval(intervalId);
                  this.isPairing = false;
                  resolve();
                } else if (this.connectionStatus === 'error') {
                  clearInterval(intervalId);
                  this.isPairing = false;
                  reject(new Error(this.error || 'Pairing failed'));
                } else if (this.pinRequired) {
                  // PIN is required, let the PIN dialog handle it
                  clearInterval(intervalId);
                  // Don't set isPairing to false yet since we'll need to continue pairing after PIN entry
                  resolve({ pinRequired: true });
                } else if (elapsed >= timeoutMs) {
                  clearInterval(intervalId);
                  this.isPairing = false;
                  this.setError('Pairing timed out');
                  reject(new Error('Pairing timed out'));
                }
                elapsed += checkInterval;
              };
              
              const intervalId = setInterval(checkPairingStatus, checkInterval);
              checkPairingStatus(); // Initial check
            });
          })
          .catch(error => {
            logger.error({
              title: 'Bluetooth Error',
              message: `Failed to initiate pairing: ${error}`
            });
            this.isPairing = false;
            this.setError(`Pairing failed: ${error}`);
            return Promise.reject(error);
          });
        } else {
          // Log success if not a Promise
          logger.debug({
            title: 'Bluetooth',
            message: `Pair request sent for device: ${address}`
          });
          this.isPairing = false;
          return Promise.resolve();
        }
      } catch (error) {
        logger.error({
          title: 'Bluetooth Error',
          message: `Failed to initiate pairing: ${error}`
        });
        this.isPairing = false;
        this.setError(`Pairing failed: ${error}`);
        return Promise.reject(error);
      }
    },
    
    // Handle PIN required for pairing
    setPinRequired(required = true) {
      this.pinRequired = required;
      if (required) {
        logger.info({
          title: 'Bluetooth',
          message: 'PIN code required for pairing'
        });
      }
    },
    
    // Disconnect from a device
    disconnectDevice(address) {
      this.connectionStatus = 'disconnecting';
      
      logger.info({
        title: 'Bluetooth',
        message: `Disconnecting from device: ${address}`
      });
      
      // Call C++ backend via bellaBridge
      return window.bellaBridge.calls.cppBackend('device', {
        function: "bluetooth",
        operation: "disconnect",
        address: address
      });
    },
    
    // Unpair a device
    unpairDevice(address) {
      this.connectionStatus = 'unpairing';
      logger.info({
        title: 'Bluetooth',
        message: `Unpairing device: ${address}`
      });
      try {
        const result = window.bellaBridge.calls.cppBackend('device', {
          function: 'bluetooth',
          operation: 'unpair',
          address: address
        });
        // Wrap result to support promise chaining even if not originally a Promise.
        return Promise.resolve(result).then(() => {
          // Refresh paired devices after unpairing
          return this.getPairedDevices();
        });
      } catch (error) {
        logger.error({
          title: 'Bluetooth Error',
          message: `Failed to unpair: ${error}`
        });
        this.setError(`Unpairing failed: ${error}`);
        return Promise.reject(error);
      }
    },
    
    // Update connection status (called by C++ bridge callback)
    updateBluetoothStatus(status, address = null) {
      // Previous status for reference
      const previousStatus = this.connectionStatus;
      
      this.connectionStatus = status;
      
      // Clear error when status changes to anything besides error
      if (status !== 'error') {
        this.error = null;
      }
      
      // Update device connection state in the devices list
      if (address && (status === 'connected' || status === 'disconnected')) {
        this.devices = this.devices.map(device => {
          if (device.address === address) {
            return { ...device, connected: status === 'connected' };
          }
          return device;
        });
      }
      
      // If we were pairing and now connected, reset pairing flag
      if (previousStatus === 'pairing' && status === 'connected') {
        this.isPairing = false;
      }
      
      logger.info({
        title: 'Bluetooth Connection',
        message: `Connection status changed to: ${status}${address ? ' for device: ' + address : ''}`
      });
      
      return true;
    },
    
    // Handle connection errors
    setError(errorMessage) {
      this.error = errorMessage;
      this.connectionStatus = 'error';
      
      logger.error({
        title: 'Bluetooth Error',
        message: errorMessage
      });
      
      return true;
    }
  }
})