// import './debug.js';
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import App from './app.vue'
import router from './router'
import mockBackend from './mock.js'
import logger from './utils/logger.js'

// Import language files
import en from './i18n/en.json'
import zh from './i18n/zh.json'
import fr from './i18n/fr.json'

// Set global logger reference for backward compatibility
window.appLogger = logger;

logger.info('Starting Vue application initialization');

// Setup i18n with a clear name to avoid confusion
const i18nInstance = createI18n({
  legacy: false, // use Composition API
  locale: localStorage.getItem('language') || 'zh', // default locale
  fallbackLocale: 'en',
  messages: { en, zh, fr }
})

// Add global i18n reference
window.i18n = i18nInstance;

// Add copyright utility functions to i18n global
window.i18n.global.getCopyrightYear = () => {
  const currentYear = new Date().getFullYear();
  return window.i18n.global.t('home.copyright', { year: currentYear });
};

window.i18n.global.updateCopyright = () => {
  const copyright = window.i18n.global.getCopyrightYear();
  // If eventBus is available, emit the update event
  if (window.eventBus) {
    window.eventBus.emit('copyright-updated', copyright);
  }
  return copyright;
};

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18nInstance)

// Add error handler
app.config.errorHandler = (err, vm, info) => {
  logger.error({
    title: 'Vue Error',
    message: `${err.message} (${info})`
  });
};

// Create a comprehensive bridge for C++ <-> Vue communication
const nativeBridgePlugin = {
  install() {
    // Store references to Pinia stores
    const storeReferences = {
      eegStore: null,
      imuStore: null,
      bluetoothStore: null,
      patientStore: null,
      adminStore: null,
      diagnosisStore: null,
      musicStore: null,
      espStore: null // Added ESP store reference
    };
    
    // Make store references globally available for debugging
    window.storeReferences = storeReferences;
    
    // Initialize critical stores immediately
    try {
      const { useEegStore } = require('./stores/eegStore.js');
      storeReferences.eegStore = useEegStore();
      logger.info('EEG store initialized during bridge setup');
      
      // Also initialize the Music store immediately to ensure it's ready for events
      const { useMusicStore } = require('./stores/musicStore.js');
      storeReferences.musicStore = useMusicStore();
      logger.info('Music store initialized during bridge setup');
      
      // Initialize the diagnosis store to ensure it's ready for diagnosis data
      const { useDiagnosisStore } = require('./stores/diagnosisStore.js');
      storeReferences.diagnosisStore = useDiagnosisStore();
      logger.info('Diagnosis store initialized during bridge setup');
      
      // Initialize the ESP store to ensure it's ready for system status data
      const { useEspStore } = require('./stores/espStore.js');
      storeReferences.espStore = useEspStore();
      logger.info('ESP store initialized during bridge setup');
      
    } catch (err) {
      logger.error({
        title: 'Store Initialization Error',
        message: `Failed to initialize stores: ${err.message}`
      });
    }
    
    // Determine if we're running in mock mode
    const isMockMode = !(window.webkit && 
                        window.webkit.messageHandlers && 
                        window.webkit.messageHandlers.bellaBridgeCalls);
    
    // Create a global bridge object
    window.bellaBridge = {
      // Flag to indicate if mock backend is active
      isMockMode: false,
      
      // Incoming handlers from C++ to Vue
      handlers: {
        // Handler for ESP32 system data updates
        updateESPData: function(data) {
          logger.info('Received ESP32 system status update from C++ backend');
          
          try {
            // Import the ESP store dynamically if needed
            if (!storeReferences.espStore) {
              try {
                const { useEspStore } = require('./stores/espStore.js');
                storeReferences.espStore = useEspStore();
                logger.info('ESP store initialized during system status update');
              } catch (err) {
                logger.error({
                  title: 'Store Access Error',
                  message: `Cannot access ESP store: ${err.message}`
                });
                return { success: false, error: 'ESP store not available' };
              }
            }
            
            // Log the data structure for debugging
            logger.debug({
              title: 'ESP32 System Status',
              message: `Heap: ${data.esp32?.heap_size || 'N/A'} bytes, WiFi: ${data.esp32?.wifi_status || 'N/A'}, Uptime: ${data.esp32?.uptime || 'N/A'} sec`
            });
            
            // Update the ESP store with the new status data
            const updateResult = storeReferences.espStore.updateSystemStatus(data);
            
            if (!updateResult) {
              return { success: false, error: 'Failed to update ESP system status' };
            }
            
            // Emit an event for components to react to the update
            if (window.eventBus) {
              window.eventBus.emit('esp-system-updated', data);
            }
            
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'ESP32 Data Error',
              message: `Error processing ESP32 system status: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        // Handler for EEG data updates
        plotEEGData: function(data) {
          logger.info('Received EEG data update from C++ backend');
          
          // Ensure eegStore is available
          if (!storeReferences.eegStore) {
            try {
              storeReferences.eegStore = useEegStore();
              logger.info('EEG store initialized during data update');
            } catch (err) {
              logger.error({
                title: 'Store Access Error',
                message: `Cannot access EEG store: ${err.message}`
              });
              return { success: false, error: 'EEG store not available' };
            }
          }
          
          // Parse incoming structure: use payload.eeg if it exists
          const eegData = data.payload && data.payload.eeg ? data.payload.eeg : data.eeg;
          if (!eegData) {
            logger.warn({
              title: 'Data Structure Warning',
              message: 'No EEG data provided in the message'
            });
            return { success: false, error: 'No EEG data provided' };
          }
          
          try {
            if (eegData.data) {
              logger.info({
                title: 'EEG Data',
                message: `Processing data with channels: ${Object.keys(eegData.data).join(', ')}, Sample count: ${Array.isArray(eegData.data.fp1) ? eegData.data.fp1.length : 'N/A'}`
              });
            } else {
              logger.warn({
                title: 'Data Structure Warning',
                message: 'Received EEG data with unexpected structure'
              });
            }
      
            const updateResult = storeReferences.eegStore.updateEEGData(data.payload);
            
            if (!updateResult) {
              return { success: false, error: 'Visualization update failed' };
            }
            
            logger.info({
              title: 'Visualization',
              message: 'EEG visualization updated successfully'
            });
            return { success: true };

          } catch (err) {
            logger.error({
              title: 'Visualization Error',
              message: `Error updating EEG visualization: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        // Handler for IMU data updates
        plotIMUData: function(data) {
          logger.info('Received IMU data update from C++ backend');
          
          // Parse incoming structure: use payload.imu if it exists
          const imuData = data.payload && data.payload.imu ? data.payload.imu : data.imu;
          if (!imuData) {
            logger.warn({
              title: 'Data Structure Warning',
              message: 'No IMU data provided in the message'
            });
            return { success: false, error: 'No IMU data provided' };
          }
          
          try {
            if (imuData.data) {
              logger.info({
                title: 'IMU Data', 
                message: `Processing IMU data with sensor: ${imuData.sensor || 'unknown'}, channels: ${imuData.channels ? imuData.channels.join(', ') : 'none'}, sample count: ${Array.isArray(imuData.data.x) ? imuData.data.x.length : 'N/A'}`
              });
            } else {
              logger.warn({
                title: 'Data Structure Warning',
                message: 'Received IMU data with unexpected structure'
              });
            }
            
            // Import IMU store dynamically if needed
            if (!storeReferences.imuStore) {
              const { useImuStore } = require('./stores/imuStore.js');
              storeReferences.imuStore = useImuStore();
              logger.info('IMU store initialized for C++ communication');
            }
            
            // Update the store with the new parsed data
            const updateResult = storeReferences.imuStore.updateIMUData(imuData);
            
            if (!updateResult) {
              return { success: false, error: 'IMU data update failed' };
            }
            
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Visualization Error',
              message: `Error updating IMU visualization: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        // New handler for EEG evaluation results
        displayEEGEvaluation: function(data) {
          logger.info('Received EEG evaluation results from C++ backend');
          
          try {
            // Log the data structure for debugging
            logger.debug({
              title: 'EEG Evaluation Data',
              message: JSON.stringify(data)
            });
            
            // Ensure eegStore is available
            if (!storeReferences.eegStore) {
              try {
                storeReferences.eegStore = useEegStore();
                logger.info('EEG store initialized during evaluation results');
              } catch (err) {
                logger.error({
                  title: 'Store Access Error',
                  message: `Cannot access EEG store for evaluation results: ${err.message}`
                });
                return { success: false, error: 'EEG store not available' };
              }
            }
            
            // Process the evaluation results through the store
            storeReferences.eegStore.processEvaluationResults(data);
            
            logger.info({
              title: 'Evaluation Results',
              message: `Processed evaluation results for diagnosis ID ${data.diagnosis_id}, stage ${data.diagnosis_stage}`
            });
            
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Evaluation Processing Error',
              message: `Error processing EEG evaluation results: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        // Handler for Bluetooth device updates
        updateBluetoothDevices: function(deviceArray) {
          logger.info('Received Bluetooth device list from C++ backend');
          
          // Import the Bluetooth store dynamically if needed
          if (!storeReferences.bluetoothStore) {
            try {
              const { useBluetoothStore } = require('./stores/bluetoothStore.js');
              storeReferences.bluetoothStore = useBluetoothStore();
              logger.info('Bluetooth store initialized during device update');
            } catch (err) {
              logger.error({
                title: 'Store Access Error',
                message: `Cannot access Bluetooth store: ${err.message}`
              });
              return { success: false, error: 'Bluetooth store not available' };
            }
          }
          
          try {
            // Log the data structure for debugging
            logger.debug({
              title: 'Bluetooth Devices',
              message: `Received ${deviceArray.length} devices from backend`
            });
            
            // Update the store with the device list
            const updateResult = storeReferences.bluetoothStore.updateDevices(deviceArray);
            
            if (!updateResult) {
              return { success: false, error: 'Failed to update device list' };
            }
            
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Bluetooth Error',
              message: `Error updating Bluetooth devices: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        // Handler for paired Bluetooth devices updates
        updatePairedDevices: function(deviceArray) {
          logger.info('Received paired Bluetooth devices from C++ backend');
          
          // Import the Bluetooth store dynamically if needed
          if (!storeReferences.bluetoothStore) {
            try {
              const { useBluetoothStore } = require('./stores/bluetoothStore.js');
              storeReferences.bluetoothStore = useBluetoothStore();
              logger.info('Bluetooth store initialized during paired devices update');
            } catch (err) {
              logger.error({
                title: 'Store Access Error',
                message: `Cannot access Bluetooth store: ${err.message}`
              });
              return { success: false, error: 'Bluetooth store not available' };
            }
          }
          
          try {
            // Log the data structure for debugging
            logger.debug({
              title: 'Paired Bluetooth Devices',
              message: `Received ${deviceArray.length} paired devices from backend`
            });
            
            // Update the store with the paired devices list
            const updateResult = storeReferences.bluetoothStore.updatePairedDevices(deviceArray);
            
            if (!updateResult) {
              return { success: false, error: 'Failed to update paired devices list' };
            }
            
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Bluetooth Error',
              message: `Error updating paired Bluetooth devices: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        // Handler for Bluetooth connection status updates
        updateBluetoothStatus: function(status, error = null) {
          logger.info('Received Bluetooth connection status update from C++ backend');
          
          // Import the Bluetooth store dynamically if needed
          if (!storeReferences.bluetoothStore) {
            try {
              const { useBluetoothStore } = require('./stores/bluetoothStore.js');
              storeReferences.bluetoothStore = useBluetoothStore();
              logger.info('Bluetooth store initialized during status update');
            } catch (err) {
              logger.error({
                title: 'Store Access Error',
                message: `Cannot access Bluetooth store: ${err.message}`
              });
              return { success: false, error: 'Bluetooth store not available' };
            }
          }
          
          try {
            // Update the connection status in the store
            storeReferences.bluetoothStore.updateBluetoothStatus(status, error);
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Bluetooth Error',
              message: `Error updating Bluetooth status: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },

        // Handler for patient data updates
        updatePatientData: function(patientData) {
          logger.info('Received patient data update from C++ backend');
          
          // Import the Patient store dynamically if needed
          if (!storeReferences.patientStore) {
            try {
              const { usePatientStore } = require('./stores/patientStore.js');
              storeReferences.patientStore = usePatientStore();
              logger.info('Patient store initialized during data update');
            } catch (err) {
              logger.error({
                title: 'Store Access Error',
                message: `Cannot access Patient store: ${err.message}`
              });
              return { success: false, error: 'Patient store not available' };
            }
          }
          
          try {
            // Use the dedicated updatePatientData method for handling all types of patient data responses
            const updateResult = storeReferences.patientStore.updatePatientData(patientData);
            
            if (!updateResult) {
              return { success: false, error: 'Failed to update patient data' };
            }
            
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Patient Error',
              message: `Error updating patient data: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        // Handler for diagnosis info updates (after creation)
        updateDiagnosisData: function(diagnosisInfo) {
          logger.info('Received diagnosis info update from C++ backend');
          
          // Import the Diagnosis store dynamically if needed
          if (!storeReferences.diagnosisStore) {
            try {
              const { useDiagnosisStore } = require('./stores/diagnosisStore.js');
              storeReferences.diagnosisStore = useDiagnosisStore();
              logger.info('Diagnosis store initialized during info update');
            } catch (err) {
              logger.error({
                title: 'Store Access Error',
                message: `Cannot access Diagnosis store: ${err.message}`
              });
              return { success: false, error: 'Diagnosis store not available' };
            }
          }
          
          try {
            // Update the diagnosis store with the new diagnosis info
            storeReferences.diagnosisStore.updateDiagnosisData(diagnosisInfo);
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Diagnosis Error',
              message: `Error updating diagnosis info: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        // Handler for EEG evaluation results specific to diagnosis
        updateEegEvaluation: function(evaluationResult) {
          logger.info('Received EEG evaluation result from C++ backend');
          
          // Import the Diagnosis store dynamically if needed
          if (!storeReferences.diagnosisStore) {
            try {
              const { useDiagnosisStore } = require('./stores/diagnosisStore.js');
              storeReferences.diagnosisStore = useDiagnosisStore();
              logger.info('Diagnosis store initialized during evaluation update');
            } catch (err) {
              logger.error({
                title: 'Store Access Error',
                message: `Cannot access Diagnosis store: ${err.message}`
              });
              return { success: false, error: 'Diagnosis store not available' };
            }
          }
          
          try {
            // Update the diagnosis store with evaluation results
            const updateResult = storeReferences.diagnosisStore.updateEegEvaluation(evaluationResult);
            
            if (!updateResult) {
              return { success: false, error: 'Failed to update EEG evaluation result' };
            }
            
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Evaluation Error',
              message: `Error updating EEG evaluation result: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        
        // Handler for music progress updates
        updateMusicProgress: function(progress, currentTime, duration) {
          //logger.debug(`Received music progress: ${progress}%, currentTime: ${currentTime}, duration: ${duration}`);
          
          // Import the Music store dynamically if needed
          if (!storeReferences.musicStore) {
            try {
              const { useMusicStore } = require('./stores/musicStore.js');
              storeReferences.musicStore = useMusicStore();
              logger.info('Music store initialized during progress update');
            } catch (err) {
              logger.error({
                title: 'Store Access Error',
                message: `Cannot access Music store: ${err.message}`
              });
              return { success: false, error: 'Music store not available' };
            }
          }
          
          try {
            // Delegate to the store's handler method and check result
            const updateResult = storeReferences.musicStore.handleMusicProgress(progress, currentTime, duration);
            
            if (!updateResult || updateResult.success === false) {
              return { success: false, error: updateResult?.error || 'Failed to update music progress' };
            }
            
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Music Progress Error',
              message: `Error updating music progress: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        // Handler for music status updates
        updateMusicStatus: function(status, error = null) {
          logger.info(`Received music status from C++ backend: ${status}`);
          
          // Import the Music store dynamically if needed
          if (!storeReferences.musicStore) {
            try {
              const { useMusicStore } = require('./stores/musicStore.js');
              storeReferences.musicStore = useMusicStore();
              logger.info('Music store initialized during status update');
            } catch (err) {
              logger.error({
                title: 'Store Access Error',
                message: `Cannot access Music store: ${err.message}`
              });
              return { success: false, error: 'Music store not available' };
            }
          }
          
          try {
            // Delegate to the store's handler method and check result
            const updateResult = storeReferences.musicStore.handleMusicStatus(status, error);
            
            if (!updateResult || updateResult.success === false) {
              return { success: false, error: updateResult?.error || 'Failed to update music status' };
            }
            
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Music Status Error',
              message: `Error updating music status: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        // Handler for music track updates
        updateMusicTrack: function(trackId) {
          logger.info(`Received music track update from C++ backend: ${trackId}`);
          
          // Import the Music store dynamically if needed
          if (!storeReferences.musicStore) {
            try {
              const { useMusicStore } = require('./stores/musicStore.js');
              storeReferences.musicStore = useMusicStore();
              logger.info('Music store initialized during track update');
            } catch (err) {
              logger.error({
                title: 'Store Access Error',
                message: `Cannot access Music store: ${err.message}`
              });
              return { success: false, error: 'Music store not available' };
            }
          }
          
          try {
            // Delegate to the store's handler method and check result
            const updateResult = storeReferences.musicStore.handleMusicTrack(trackId);
            
            if (!updateResult || updateResult.success === false) {
              return { success: false, error: updateResult?.error || 'Failed to update music track' };
            }
            
            return { success: true };
          } catch (err) {
            logger.error({
              title: 'Music Track Error',
              message: `Error updating music track: ${err.message}`
            });
            return { success: false, error: err.message };
          }
        },
        
        registerHandler: function(handlerName, handlerFn) {
          if (typeof handlerFn === 'function') {
            this[handlerName] = handlerFn;
            logger.info(`Registered handler: ${handlerName}`);
            return true;
          }
          logger.warn(`Failed to register handler: ${handlerName} is not a function`);
          return false;
        }
      },
      
      // Outgoing calls from Vue to C++
      calls: {
        // Function to send sensor to C++ backend
        cppBackend: function(type, params) {
          logger.info(`Sending command to C++ backend: ${type}`);
          logger.debug(`Command parameters: ${JSON.stringify(params)}`);
          
          // If window.webkit and messageHandlers exist (WebKitGTK environment)
          if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bellaBridgeCalls) {
            try {
              // Send message to C++ through WebKit message handler
              window.webkit.messageHandlers.bellaBridgeCalls.postMessage({
                type: type,
                params: params
              });
              return true;
            } catch (err) {
              logger.error({
                title: 'Communication Error',
                message: `Error sending action to C++ backend: ${err.message}`
              });
              return false;
            }
          } else {
            logger.warn({
              title: 'Environment Warning',
              message: 'Native bridge not available. Running in browser mode with mock backend.'
            });
            
            // If in browser mode, use mock backend
            if (window.bellaBridge.isMockMode && mockBackend[type]) {
              return mockBackend[type](params);
            }
            return false;
          }
        }
      },
      
      // Import the mock backend
      mock: mockBackend
    };
    
    // Expose handler functions directly on the bellaBridge object for C++ access
    Object.keys(window.bellaBridge.handlers).forEach(handlerName => {
      window.bellaBridge[handlerName] = window.bellaBridge.handlers[handlerName];
    });
    
    // Initialize global access methods for mock backend only if needed
    if (window.bellaBridge.isMockMode) {
      logger.info({
        title: 'Mock Mode',
        message: 'Native bridge not available. Initializing mock backend for browser testing.'
      });
      mockBackend.initGlobalAccess();
    } else {
      logger.info({
        title: 'Production Mode',
        message: 'Native C++ bridge detected and active. Mock backend disabled.'
      });
    }
    logger.info({
      title: 'Initialization',
      message: `Native bridge initialized, ready for ${window.bellaBridge.isMockMode ? 'mock' : 'C++'} communication`
    });

  }
};

// Call after mount to make sure DOM is ready
app.use(nativeBridgePlugin);
app.mount('#app');

logger.info({
  title: 'Initialization Complete', 
  message: 'Vue application mounted and C++ bridge initialized'
});
