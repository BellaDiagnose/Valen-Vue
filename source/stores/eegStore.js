import { defineStore } from 'pinia';
import { markRaw } from 'vue';
// Fix the import to properly use the named exports
import { THREE } from './threeHelper.js';
import logger from '../utils/logger.js';

// Import the store definition, not a store instance
import { useMusicStore } from './musicStore.js';
import { useDiagnosisStore } from './diagnosisStore.js';

// Import router from the correct location
import router from '../router/index.js';

// Import modularized components
import Eeg2dRenderer from './eeg/eeg2dRenderer.js';
import Eeg3dRenderer from './eeg/eeg3dRenderer.js';
import EegDataProcessor from './eeg/eegDataProcessor.js';
import EegActions from './eeg/eegActions.js';

// Import mock EEG functionality
import { mockEEG } from '../mock.js';

export const useEegStore = defineStore('eeg', {
  state: () => ({
    // Add THREE to state so it can be accessed from components
    three: markRaw(THREE),
    
    // EEG data structure
    sensorData: {
      sensor: '',
      channels: [],
      data: {
        // Channel data arrays (will contain voltage values)
        fp1: [],
        fpz: [],
        fp2: [],
        // SNR values (signal-to-noise ratio)
        snr: {
          fp1: 0,
          fpz: 0,
          fp2: 0
        }
      }
    },
    
    // Visualization state
    eegPlot: {
      active: false,
      container: null,
      visualizationMode: 'lines', // 'lines' or '3d'
      fps: 0,
      // Audio configuration
      audio: {
        enabled: true,
        currentStage: 0,
        stageFiles: {
          1: 'bp1.ogg', // Initial stage
          2: 'bp2.ogg', // Transition stage
          3: 'bp3.ogg', // Main recording stage (70 seconds)
          4: 'bp4.ogg'  // Final stage
        },
        stageDurations: {
          1: 10 * 1000,   // 10 seconds
          2: 10 * 1000,   // 10 seconds
          3: 70 * 1000,   // 70 seconds
          4: 10 * 1000    // 10 seconds
        },
        currentAudioId: null,
        stageTimerId: null,
        stageStartTime: null
      },
      shuttingDown: false // Flag to prevent restart during shutdown
    },
    
    // Circular buffer system for efficient data management
    buffer: {
      // Maximum number of points to keep per channel
      maxPoints: 500,
      // Points to display in the visualization window
      displayPoints: 125,
      // Circular buffers for each channel
      circular: {
        fp1: [], 
        fpz: [], 
        fp2: []
      },
      // Write indexes for circular buffers
      writeIndex: {
        fp1: 0,
        fpz: 0,
        fp2: 0
      },
      // Incoming data buffer (temporary storage before adding to circular buffer)
      incoming: {
        fp1: [],
        fpz: [],
        fp2: []
      },
      // Flag to indicate new data is available
      hasNewData: false,
      // Timestamp for performance tracking
      startTime: null
    },
    
    // Local non-reactive tracking
    lastFrameTime: 0,
    frameCount: 0,
    brainScaleText: 'Scale: 10%',  // Reactive property for UI
    
    // Module instances (created and stored when needed)
    _renderers: {
      renderer2d: null,
      renderer3d: null,
      dataProcessor: null,
      actions: null
    },
    
    // Add timestamp for memory management
    lastMemoryManagementTime: null,

    // Add a new property to track if we're in standalone brain view mode
    standaloneModelMode: false,
  }),
  
  getters: {
    isActive: (state) => state.eegPlot.active,
    currentMode: (state) => state.eegPlot.visualizationMode,
    
    // Get latest value for each channel
    latestValues: (state) => {
      const result = {};
      
      for (const channel of state.sensorData.channels) {
        if (Array.isArray(state.sensorData.data[channel]) && 
            state.sensorData.data[channel].length > 0) {
          result[channel] = state.sensorData.data[channel][state.sensorData.data[channel].length - 1];
        } else {
          result[channel] = 0;
        }
      }
      
      return result;
    },

    // New getter to access current diagnosis stage directly
    currentDiagnosisStage() {
      const diagnosisStore = useDiagnosisStore();
      return diagnosisStore.currentDiagnosisStage;
    },
    
    // Check if we're in mock mode by accessing the window.bellaBridge property
    isMockMode() {
      return !!window.bellaBridge?.isMockMode;
    }
  },
  
  actions: {
    /**
     * Get or create data processor
     */
    getDataProcessor() {
      if (!this._renderers.dataProcessor) {
        this._renderers.dataProcessor = new EegDataProcessor(this);
      }
      return this._renderers.dataProcessor;
    },
    
    /**
     * Get or create 2D renderer
     */
    get2dRenderer() {
      if (!this._renderers.renderer2d) {
        this._renderers.renderer2d = new Eeg2dRenderer(this);
      }
      return this._renderers.renderer2d;
    },
    
    /**
     * Get or create 3D renderer
     */
    get3dRenderer() {
      if (!this._renderers.renderer3d) {
        this._renderers.renderer3d = new Eeg3dRenderer(this);
      }
      return this._renderers.renderer3d;
    },

    /**
     * Get or create actions handler
     */
    getActions() {
      if (!this._renderers.actions) {
        this._renderers.actions = new EegActions(this);
      }
      return this._renderers.actions;
    },
    
    /**
     * Initialize visualization based on mode
     * @param {HTMLElement} container - DOM element to render into
     */
    initializeVisualization(container) {
      // Initialize circular buffers
      this.getDataProcessor().initializeCircularBuffers();
      
      return this.eegPlot.visualizationMode === '3d' ? 
        this.get3dRenderer().initialize(container) : 
        this.get2dRenderer().initialize(container);
    },
    
    /**
     * Toggle between different stats panels
     * Cycles through FPS, MS, and MB
     */
    toggleStatsPanel() {
      if (this.eegPlot.visualizationMode === '3d') {
        const renderer = this.get3dRenderer();
        if (renderer.threeObjects?.stats) {
          // Get current panel and cycle to next
          const currentPanel = renderer.threeObjects.stats.currentPanel || 0;
          const nextPanel = (currentPanel + 1) % 3; // Cycle through 0, 1, 2
          
          renderer.threeObjects.stats.showPanel(nextPanel);
          renderer.threeObjects.stats.currentPanel = nextPanel;
          
          // Return panel name for UI feedback
          const panels = ['FPS', 'MS', 'MB'];
          return panels[nextPanel];
        }
      } else {
        return this.get2dRenderer().toggleStatsPanel();
      }
    },
    
    /**
     * Toggle between 2D and 3D visualization modes
     */
    toggleViewMode() {
      // Save current active state and standalone state
      const wasActive = this.eegPlot.active;
      const wasStandalone = this.standaloneModelMode;
      
      // Stop current visualization if it's active
      if (wasActive) {
        this.getActions().stopEEGVisualization();
      }
      
      // Switch mode
      this.eegPlot.visualizationMode = this.eegPlot.visualizationMode === 'lines' ? '3d' : 'lines';
      
      // Clean up current visualization objects
      this.cleanupObjects();
      
      // Initialize new visualization
      if (this.eegPlot.container) {
        this.initializeVisualization(this.eegPlot.container);
        
        // Restart in the appropriate mode
        if (wasActive) {
          this.getActions().startEEGVisualization();
        } else if (wasStandalone && this.eegPlot.visualizationMode === '3d') {
          // Restart in standalone mode for 3D
          this.displayBrainModelStandalone();
        }
      }
      
      return this.eegPlot.visualizationMode;
    },
    
    /**
     * Start or stop EEG visualization
     */
    toggleEEGVisualization() {
      if (this.eegPlot.active) {
        this.getActions().stopEEGVisualization();
      } else {
        this.getActions().startEEGVisualization();
      }
    },
    
    /**
     * Start EEG visualization and data collection
     * @param {Object} options - Optional parameters (diagnosis_id and diagnosis_stage)
     */
    startEEGVisualization(options = {}) {
      return this.getActions().startEEGVisualization(options);
    },
    
    /**
     * Play audio for the specified stage
     */
    playAudioForStage(stage) {
      return this.getActions().playAudioForStage(stage);
    },
    
    /**
     * Progress to the next stage
     */
    progressToNextStage() {
      return this.getActions().progressToNextStage();
    },
    
    /**
     * Update diagnosis stage (delegates to diagnosisStore)
     */
    updateDiagnosisStage(stage) {
      return this.getActions().updateDiagnosisStage(stage);
    },
    
    /**
     * Stop EEG visualization and data collection
     */
    stopEEGVisualization() {
      return this.getActions().stopEEGVisualization();
    },
    
    /**
     * Clear all EEG data
     */
    clearData() {
      this.sensorData.data.fp1 = [];
      this.sensorData.data.fpz = [];
      this.sensorData.data.fp2 = [];
      
      this.buffer.incoming.fp1 = [];
      this.buffer.incoming.fpz = [];
      this.buffer.incoming.fp2 = [];
      
      // Reset circular buffers
      this.getDataProcessor().initializeCircularBuffers();
      
      this.sensorData.data.snr = {
        fp1: 0,
        fpz: 0,
        fp2: 0
      };
    },
    
    /**
     * Start animation loop
     */
    startAnimationLoop() {
      const dataProcessor = this.getDataProcessor();
      
      if (this.eegPlot.visualizationMode === '3d') {
        this.get3dRenderer().startAnimationLoop(dataProcessor);
      } else {
        this.get2dRenderer().startAnimationLoop(dataProcessor);
      }
    },
    
    /**
     * Handle window resize
     */
    handleResize() {
      if (this.eegPlot.visualizationMode === '3d') {
        if (this._renderers.renderer3d) {
          this._renderers.renderer3d.handleResize();
        }
      } else {
        if (this._renderers.renderer2d) {
          this._renderers.renderer2d.handleResize();
        }
      }
    },
    
    /**
     * Clean up all visualization objects
     */
    cleanupObjects() {
      // Clean up 2D renderer
      if (this._renderers.renderer2d) {
        this._renderers.renderer2d.cleanup();
        this._renderers.renderer2d = null;
      }
      
      // Clean up 3D renderer
      if (this._renderers.renderer3d) {
        this._renderers.renderer3d.cleanup();
        this._renderers.renderer3d = null;
      }
      
      // Clean up data processor
      if (this._renderers.dataProcessor) {
        // Call any cleanup method if implemented in the processor
        if (typeof this._renderers.dataProcessor.cleanup === 'function') {
          this._renderers.dataProcessor.cleanup();
        }
        this._renderers.dataProcessor = null;
      }
      
      // Clean up actions handler
      this._renderers.actions = null;
      
      // Release any large data arrays
      this.releaseBufferMemory();
      
      // Force garbage collection hint (won't guarantee GC runs)
      if (window.gc) {
        try {
          window.gc();
        } catch (e) {
          logger.debug('Manual garbage collection not available');
        }
      }
    },
    
    /**
     * Release memory used by data buffers
     */
    releaseBufferMemory() {
      // Clear main data arrays
      this.sensorData.data.fp1 = [];
      this.sensorData.data.fpz = [];
      this.sensorData.data.fp2 = [];
      
      // Clear incoming buffers
      this.buffer.incoming.fp1 = [];
      this.buffer.incoming.fpz = [];
      this.buffer.incoming.fp2 = [];
      
      // Clear circular buffers
      this.buffer.circular.fp1 = [];
      this.buffer.circular.fpz = [];
      this.buffer.circular.fp2 = [];
      
      // Reset write indexes
      this.buffer.writeIndex.fp1 = 0;
      this.buffer.writeIndex.fpz = 0;
      this.buffer.writeIndex.fp2 = 0;
      
      // Reset other tracking properties
      this.buffer.hasNewData = false;
      this.buffer.startTime = null;
    },
    
    /**
     * Update EEG data from an external source (native bridge)
     */
    updateEEGData(data) {
      return this.getActions().updateEEGData(data);
    },
    
    /**
     * Load detailed 3D brain model
     * @param {string} modelPath - Path to the OBJ model file
     * @returns {Promise<Object>} - Promise that resolves with the loaded model
     */
    loadDetailedBrainModel(modelPath) {
      if (!modelPath) {
        const errorMsg = 'Cannot load brain model: No model path provided';
        logger.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
      }
      
      // State tracking object
      const loadingState = {
        initialMode: this.eegPlot.visualizationMode,
        wasActive: this.eegPlot.active,
        modelPath,
        logPath: modelPath.startsWith('data:') 
          ? modelPath.substring(0, 30) + '...' 
          : modelPath,
      };
      
      // Log important diagnostic information
      logger.info({
        title: 'Brain Model Loading',
        message: `Loading model: ${loadingState.logPath}`
      });
      
      logger.debug({
        title: 'Brain Model Loading Details', 
        message: JSON.stringify({
          modelType: modelPath.startsWith('data:') ? 'Data URI' : 'File path',
          currentMode: this.eegPlot.visualizationMode,
          rendererInitialized: !!this._renderers.renderer3d,
          containerExists: !!this.eegPlot.container
        })
      });
      
      // Main promise for the entire loading process
      return new Promise((resolve, reject) => {
        // Step 1: Switch to 3D mode if needed
        this.ensureCorrectVisualizationMode(loadingState)
          .then(() => this.initializeRenderer(loadingState))
          .then(() => this.loadModel(loadingState))
          .then(result => {
            logger.info('Brain model loaded successfully');
            resolve(result);
          })
          .catch(error => {
            logger.error(`Brain model loading failed: ${error.message}`);
            reject(error);
          });
      });
    },
    
    /**
     * Helper method to ensure we're in 3D visualization mode
     * @param {Object} state - The loading state object
     * @returns {Promise<void>}
     */
    ensureCorrectVisualizationMode(state) {
      return new Promise((resolve) => {
        if (this.eegPlot.visualizationMode !== '3d') {
          logger.warn('Switching to 3D mode for brain model loading');
          
          // Stop any active visualization
          if (state.wasActive) {
            this.getActions().stopEEGVisualization();
          }
          
          // Switch visualization mode
          this.eegPlot.visualizationMode = '3d';
          
          // Clean up current visualization objects
          this.cleanupObjects();
          
          // Short delay to ensure state update is processed
          setTimeout(resolve, 50);
        } else {
          // Already in 3D mode, continue immediately
          resolve();
        }
      });
    },
    
    /**
     * Helper method to initialize the 3D renderer
     * @param {Object} state - The loading state object
     * @returns {Promise<void>}
     */
    initializeRenderer(state) {
      return new Promise((resolve, reject) => {
        // If renderer already exists and is initialized, continue
        if (this._renderers.renderer3d && this._renderers.renderer3d.threeObjects) {
          return resolve();
        }
        
        // Ensure we have a container
        if (!this.eegPlot.container) {
          const container = document.getElementById('eeg_plot_container');
          if (container) {
            this.eegPlot.container = container;
          } else {
            return reject(new Error('EEG plot container not found'));
          }
        }
        
        logger.info('Initializing 3D renderer for brain model loading');
        
        // Initialize the visualization
        const result = this.initializeVisualization(this.eegPlot.container);
        
        if (!result) {
          return reject(new Error('Failed to initialize 3D renderer'));
        }
        
        // Wait for the renderer to be fully initialized
        setTimeout(() => {
          if (!this._renderers.renderer3d) {
            reject(new Error('3D renderer initialization failed'));
          } else {
            // Restart if it was active before
            if (state.wasActive) {
              this.getActions().startEEGVisualization();
            }
            resolve();
          }
        }, 100);
      });
    },
    
    /**
     * Helper method to load the actual brain model
     * @param {Object} state - The loading state object
     * @returns {Promise<Object>} - Promise resolving with the loaded model
     */
    loadModel(state) {
      return new Promise((resolve, reject) => {
        logger.info('Loading brain model...');
        
        if (!this._renderers.renderer3d) {
          return reject(new Error('3D renderer not available'));
        }
        
        // Delegate to the renderer's load method
        this.get3dRenderer().loadDetailedBrainModel(state.modelPath)
          .then(resolve)
          .catch(error => {
            logger.error(`Error in model loading: ${error.message}`);
            logger.warn('Using simple brain model as fallback');
            reject(error);
          });
      });
    },

    /**
     * Remove detailed 3D brain model
     */
    removeDetailedBrainModel() {
      if (this.eegPlot.visualizationMode === '3d' && this._renderers.renderer3d) {
        this._renderers.renderer3d.removeDetailedBrainModel();
      }
    },

    /**
     * Send EEG evaluation request to the C++ backend
     * @param {Object} options - Optional parameters (diagnosis_id and diagnosis_stage)
     */
    evaluateEEG(options = {}) {
      return this.getActions().evaluateEEG(options);
    },
    
    /**
     * Set current diagnosis - delegates to the diagnosisStore method
     * @param {Object} diagnosis - Diagnosis object
     */
    setCurrentDiagnosis(diagnosis) {
      return this.getActions().setCurrentDiagnosis(diagnosis);
    },
    
    /**
     * Manage circular buffer data to ensure optimal memory usage
     * This should be called periodically to prevent memory leaks
     */
    manageCircularBufferMemory() {
      // Check if we need to run memory management (every 10 seconds or so)
      const now = Date.now();
      if (this.lastMemoryManagementTime && (now - this.lastMemoryManagementTime) < 10000) {
        return; // Not time to run memory management yet
      }
      
      this.lastMemoryManagementTime = now;
      logger.debug('Running circular buffer memory management');
      
      const bufferSize = this.buffer.maxPoints;
      const channels = ['fp1', 'fpz', 'fp2'];
      
      for (const channel of channels) {
        const circularBuffer = this.buffer.circular[channel];
        
        // If buffer exceeds configured size by more than 10%, prune it
        if (circularBuffer.length > bufferSize * 1.1) {
          logger.debug(`Pruning ${channel} circular buffer from ${circularBuffer.length} to ${bufferSize}`);
          
          // Create a new array with just the data we want to keep
          const newBuffer = new Array(bufferSize);
          const startIdx = circularBuffer.length - bufferSize;
          
          for (let i = 0; i < bufferSize; i++) {
            newBuffer[i] = circularBuffer[startIdx + i];
          }
          
          // Replace the old buffer with our optimized one
          this.buffer.circular[channel] = newBuffer;
          
          // Reset the write index
          this.buffer.writeIndex[channel] = bufferSize % bufferSize;
        }
      }
    },

    /**
     * Display the 3D brain model without EEG data recording
     * @param {Object} options - Optional initialization parameters
     * @returns {Boolean} - Success status
     */
    displayBrainModelStandalone(options = {}) {
      logger.info('Displaying brain model in standalone mode (no data recording)');
      
      // Set the visualization mode to 3D
      this.eegPlot.visualizationMode = '3d';
      
      // Mark that we're in standalone mode
      this.standaloneModelMode = true;
      
      // Clean up current visualization objects if any exist
      this.cleanupObjects();
      
      // Initialize the visualization with the container
      if (!this.eegPlot.container && options.container) {
        this.eegPlot.container = options.container;
      }
      
      // Try to initialize visualization
      if (!this.eegPlot.container) {
        const container = document.getElementById('eeg_plot_container');
        if (container) {
          this.eegPlot.container = container;
        } else {
          logger.error('No container found for displaying brain model');
          return false;
        }
      }
      
      // Initialize the 3D visualization
      const initResult = this.initializeVisualization(this.eegPlot.container);
      
      if (!initResult) {
        logger.error('Failed to initialize 3D visualization');
        return false;
      }
      
      // Start the standalone animation loop (doesn't require data processor)
      this.get3dRenderer().startStandaloneAnimationLoop();
      
      return true;
    },
    
    /**
     * Load brain model in standalone mode without EEG data
     * @param {string} modelPath - Path to the OBJ model file
     * @returns {Promise<Object>} - Promise resolving with the loaded model
     */
    loadBrainModelStandalone(modelPath) {
      // First make sure we've initialized the 3D renderer in standalone mode
      if (!this._renderers.renderer3d) {
        if (!this.displayBrainModelStandalone()) {
          return Promise.reject(new Error('Failed to initialize 3D renderer for brain model'));
        }
      }
      
      // Now load the model
      return this.get3dRenderer().loadDetailedBrainModel(modelPath);
    },
  }
});