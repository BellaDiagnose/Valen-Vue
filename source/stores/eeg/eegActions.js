/**
 * EEG Actions
 * Module containing EEG control and state management operations
 */
import { useMusicStore } from '../musicStore.js';
import { useDiagnosisStore } from '../diagnosisStore.js';
import logger from '../../utils/logger.js';
import { mockEEG } from '../../mock.js';

export default class EegActions {
  constructor(store) {
    this.store = store;
  }

  /**
   * Start EEG visualization and data collection
   * @param {Object} options - Optional parameters (diagnosis_id and diagnosis_stage)
   */
  startEEGVisualization(options = {}) {
    const store = this.store;
    if (store.eegPlot.active) return;
    
    store.eegPlot.active = true;
    
    logger.info(`Starting EEG visualization in ${store.eegPlot.visualizationMode} mode`);
    
    // Clear existing data
    store.clearData();
    
    // Make sure visualization is initialized
    if ((store.eegPlot.visualizationMode === 'lines' && !store._renderers.renderer2d) || 
        (store.eegPlot.visualizationMode === '3d' && !store._renderers.renderer3d)) {
      // Try to find container if not already set
      if (!store.eegPlot.container) {
        const container = document.getElementById('eeg_plot_container');
        if (container) {
          store.initializeVisualization(container);
        } else {
          logger.warn('EEG plot container not found, visualization may be incomplete');
        }
      } else {
        store.initializeVisualization(store.eegPlot.container);
      }
    }
    
    // Get diagnosis info from options or from the diagnosis store
    const diagnosisStore = useDiagnosisStore();
    const diagnosis_id = options.diagnosis_id || diagnosisStore.currentDiagnosis?.diagnosis_id || 0;
    
    // Update the diagnosis stage in the diagnosis store if provided in options
    if (options.diagnosis_stage) {
      diagnosisStore.updateDiagnosisStage(options.diagnosis_stage);
    }
    
    // Get the current stage from diagnosis store
    const diagnosis_stage = diagnosisStore.currentDiagnosisStage;
    
    // Update the current audio stage
    store.eegPlot.audio.currentStage = diagnosis_stage;
    
    // Start collecting data from native bridge or use mock mode
    if (window.bellaBridge?.calls) {
      window.bellaBridge.calls.cppBackend('sensor', {
          sensor: "ads1299",
          action: "start",
          diagnosis_id: diagnosis_id,
          diagnosis_stage: diagnosis_stage
      });
    }

    if (store.isMockMode) {
      // Directly call mockEEG.start() instead of using a wrapper method
      mockEEG.start();
      logger.info('Started EEG mock data simulation');
    }
    
    // Play audio associated with current diagnosis stage
    this.playAudioForStage(diagnosis_stage);
    
    // Start animation loop
    store.startAnimationLoop();
  }
  
  /**
   * Play audio for the specified stage
   */
  playAudioForStage(stage) {
    const store = this.store;
    if (!store.eegPlot.audio.enabled) return;
  
    // Don't set up new audio or timers if we're in shutdown process
    if (store.eegPlot.shuttingDown) {
      logger.info('Ignoring audio playback during shutdown process');
      return;
    }
    
    const audioFile = store.eegPlot.audio.stageFiles[stage];
    if (!audioFile) {
      logger.warn(`No audio file defined for stage ${stage}`);
      return;
    }

    try {
      // Clear any existing stage timer
      if (store.eegPlot.audio.stageTimerId) {
        clearTimeout(store.eegPlot.audio.stageTimerId);
        store.eegPlot.audio.stageTimerId = null;
      }

      // Set starting time for this stage
      store.eegPlot.audio.stageStartTime = Date.now();
      
      // Get music store
      const musicStore = useMusicStore();
      const trackId = audioFile.split('.')[0]; // Use the file name without extension as track ID

      // Play the track for all stages - force playback regardless of user interaction
      musicStore.playTrack(trackId, true);
      store.eegPlot.audio.currentStage = stage;

      // Set up the timer for stage progression based on defined durations
      const stageDuration = store.eegPlot.audio.stageDurations[stage];
      
      if (stageDuration) {
        logger.info(`Setting up timer for stage ${stage} with duration of ${stageDuration/1000} seconds`);
        
        store.eegPlot.audio.stageTimerId = setTimeout(() => {
          // For stage 4 (final stage), stop EEG visualization after the duration
          if (stage === 4) {
            logger.info('Final stage 4 completed - stopping EEG visualization');
            this.stopEEGVisualization();
          } else {
            logger.info(`Stage ${stage} completed - progressing to next stage`);
            this.progressToNextStage();
          }
        }, stageDuration);
      }
    } catch (error) {
      logger.error(`Error playing audio for stage ${stage}: ${error.message}`);
    }
  }
  
  /**
   * Progress to the next stage
   */
  progressToNextStage() {
    const store = this.store;
    // Don't progress if we're shutting down
    if (store.eegPlot.shuttingDown) {
      logger.info('Ignoring stage progression during shutdown process');
      return;
    }
    
    const nextStage = store.eegPlot.audio.currentStage + 1;
    logger.debug(`Attempting to progress from stage ${store.eegPlot.audio.currentStage} to stage ${nextStage}`);
    
    // If we're progressing from stage 3 to stage 4, trigger automatic evaluation
    if (store.eegPlot.audio.currentStage === 3 && nextStage === 4) {
      logger.info('Stage 3 completed - triggering automatic EEG evaluation');
      
      // Get diagnosis info for the evaluation
      const diagnosisStore = useDiagnosisStore();
      const diagnosis_id = diagnosisStore.currentDiagnosis?.diagnosis_id || 0;
      
      // Call the evaluation backend through C++ interface
      if (window.bellaBridge?.calls) {
        window.bellaBridge.calls.cppBackend('sensor', {
          sensor: "ads1299",
          action: "evaluate",
          diagnosis_id: diagnosis_id,
          diagnosis_stage: 3 // We evaluate stage 3 data specifically
        });
        logger.info(`Sent EEG evaluation request for diagnosis_id: ${diagnosis_id}, stage: 3`);
      } else {
        logger.error('Native bridge not available for EEG evaluation');
      }
    }
    
    // Check if the next stage exists
    if (store.eegPlot.audio.stageFiles[nextStage]) {
      logger.info(`Progressing to next audio stage: ${nextStage}`);
      
      // Explicitly notify the backend about the stage change
      const diagnosisStore = useDiagnosisStore();
      const diagnosis_id = diagnosisStore.currentDiagnosis?.diagnosis_id || 0;
      
      if (window.bellaBridge?.calls) {
        logger.info(`Sending stage change notification to backend for stage ${nextStage}`);
        window.bellaBridge.calls.cppBackend('sensor', {
          sensor: "ads1299",
          action: "stage",
          diagnosis_id: diagnosis_id,
          diagnosis_stage: nextStage
        });
      }
      
      // Update local stage
      this.updateDiagnosisStage(nextStage);
      
      // Play audio for the new stage
      this.playAudioForStage(nextStage);
    } else {
      logger.info('No more stages available, stopping EEG visualization');
      this.stopEEGVisualization();
    }
  }
  
  /**
   * Update diagnosis stage (delegates to diagnosisStore)
   */
  updateDiagnosisStage(stage) {
    const diagnosisStore = useDiagnosisStore();
    return diagnosisStore.updateDiagnosisStage(stage);
  }
  
  /**
   * Stop EEG visualization and data collection
   */
  stopEEGVisualization() {
    const store = this.store;
    if (!store.eegPlot.active) return;
    
    store.eegPlot.active = false;
    store.eegPlot.shuttingDown = true; // Set flag to prevent race condition restarts
    
    logger.info('Stopping EEG visualization');
    
    // Get diagnosis info from the diagnosis store
    const diagnosisStore = useDiagnosisStore();
    const diagnosis_id = diagnosisStore.currentDiagnosis?.diagnosis_id || 0;
    const diagnosis_stage = diagnosisStore.currentDiagnosisStage;
    
    // Clear all timers regardless of type
    if (store.eegPlot.audio.stageTimerId) {
      clearTimeout(store.eegPlot.audio.stageTimerId);
      clearInterval(store.eegPlot.audio.stageTimerId);
      store.eegPlot.audio.stageTimerId = null;
      logger.info('Cleared stage progression timer');
    }
    
    // Stop data generation based on mode
    if (window.bellaBridge?.calls) {
      logger.info(`Sending EEG stop command for diagnosis_id: ${diagnosis_id}, stage: ${diagnosis_stage}`);
      
      window.bellaBridge.calls.cppBackend('sensor', {
          sensor: "ads1299",
          action: "stop",
          diagnosis_id: diagnosis_id,
          diagnosis_stage: diagnosis_stage
      });
    }

    if (store.isMockMode) {
      mockEEG.stop();
      logger.info('Stopped EEG mock data simulation');
    }

    // Stop any playing audio using audioStore - wrapped in try/catch
    try {
      const audioStore = useMusicStore();
      audioStore.stopMusic();
    } catch (error) {
      logger.error(`Error stopping audio: ${error.message}`);
    }
    
    // Stop animation loop depending on current visualization mode
    if (store.eegPlot.visualizationMode === '3d') {
      if (store._renderers.renderer3d) {
        store._renderers.renderer3d.cleanup();
      }
    } else {
      if (store._renderers.renderer2d) {
        store._renderers.renderer2d.cleanup();
      }
    }
    
    // Reset shutdown flag after a short delay to ensure any pending operations complete
    setTimeout(() => {
      store.eegPlot.shuttingDown = false;
      logger.debug('Reset EEG shutdown flag');
    }, 1000);
  }

  /**
   * Send EEG evaluation request to the C++ backend
   * @param {Object} options - Optional parameters (diagnosis_id and diagnosis_stage)
   */
  evaluateEEG(options = {}) {
    // Get diagnosis info from options or from the diagnosis store
    const diagnosisStore = useDiagnosisStore();
    const diagnosis_id = options.diagnosis_id || diagnosisStore.currentDiagnosis?.diagnosis_id || 0;
    const diagnosis_stage = options.diagnosis_stage || diagnosisStore.currentDiagnosisStage;
    
    if (window.bellaBridge && window.bellaBridge.calls) {
      logger.info(`Sending EEG evaluation request for diagnosis_id: ${diagnosis_id}, stage: ${diagnosis_stage}`);
      
      window.bellaBridge.calls.cppBackend('sensor', {
        sensor: "ads1299",
        action: "evaluate",
        diagnosis_id: diagnosis_id,
        diagnosis_stage: diagnosis_stage
      });
      
      return true;
    } else {
      logger.error('Native bridge not available for EEG evaluation');
      return false;
    }
  }
  
  /**
   * Set current diagnosis - delegates to the diagnosisStore method
   * @param {Object} diagnosis - Diagnosis object
   */
  setCurrentDiagnosis(diagnosis) {
    if (!diagnosis || !diagnosis.diagnosis_id) {
      logger.warn('Attempted to set invalid diagnosis');
      return false;
    }
    
    try {
      // Use the centralized method from diagnosisStore
      const diagnosisStore = useDiagnosisStore();
      return diagnosisStore.setCurrentDiagnosis(diagnosis);
    } catch (error) {
      logger.error(`Error setting current diagnosis: ${error.message}`);
      return false;
    }
  }

  /**
   * Update EEG data from an external source (native bridge)
   */
  updateEEGData(data) {
    const store = this.store;
    
    // Ignore incoming data during shutdown process
    if (store.eegPlot.shuttingDown) {
      logger.debug('Ignoring incoming EEG data during shutdown process');

      // Get diagnosis info from the diagnosis store
      const diagnosisStore = useDiagnosisStore();
      const diagnosis_id = diagnosisStore.currentDiagnosis?.diagnosis_id || 0;
      const diagnosis_stage = diagnosisStore.currentDiagnosisStage;

      // Send stop command if we have a native bridge
      if (window.bellaBridge?.calls) {
        window.bellaBridge.calls.cppBackend('sensor', {
          sensor: "ads1299",
          action: "stop",
          diagnosis_id: diagnosis_id,
          diagnosis_stage: diagnosis_stage
        });
        logger.info('Sent stop command to EEG hardware during shutdown');
      }

      return false;
    }
    
    const dataProcessor = store.getDataProcessor();
    const result = dataProcessor.updateEEGData(data);
    
    // Run memory management periodically during data updates
    store.manageCircularBufferMemory();
    
    // Auto-start visualization if not active but receiving data
    // Only if not in the shutdown process
    if (result && !store.eegPlot.active && !store.eegPlot.shuttingDown) {
      logger.info('Auto-starting EEG visualization due to incoming data');
      this.startEEGVisualization();
    }
    
    return result;
  }
}