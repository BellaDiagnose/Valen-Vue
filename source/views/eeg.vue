<template>
  <div class="eeg-page">
    
    <!-- No Diagnosis Selected Overlay -->
    <div v-if="!diagnosisStore.currentDiagnosis" class="no-diagnosis-overlay">
      <div class="no-diagnosis-panel">
        <h2>{{ $t('eeg.noDiagnosisSelected') || 'No Diagnosis Selected' }}</h2>
        <p>{{ $t('eeg.pleaseSelectDiagnosis') || 'Please select a diagnosis to proceed with EEG visualization' }}</p>
        
        <div class="overlay-actions">
          <button type="button" @click="navigateToDiagnosis" class="primary-button">
            {{ $t('eeg.goToDiagnosisSelection') || 'Go to Diagnosis Selection' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Existing EEG Visualization Content -->
    <div v-else class="eeg-visualization">
      <div class="controls">
        <button @click="toggleEEGVisualization" class="eeg-btn">
          {{ eegStore.eegPlot.active ? $t('eeg.controls.stopRecording') : $t('eeg.controls.startRecording') }}
        </button>
        <!-- Toggle view mode button is always visible -->
        <button @click="toggleViewMode" class="eeg-btn view-mode-btn">
          {{ eegStore.eegPlot.visualizationMode === '3d' ? $t('eeg.controls.showLineChart') || 'Show Line Chart' : $t('eeg.controls.show3DView') || 'Show 3D View' }}
        </button>
        <button @click="evaluateEEG" class="eeg-btn evaluate-eeg-btn">
          {{ $t('eeg.controls.evaluate') }}
        </button>
      </div>

      <div ref="plotContainer" id="eeg_plot_container" class="plot-container">
        <!-- Stage and countdown overlay -->
        <div class="stage-overlay" v-if="eegStore.eegPlot.active">
          <div class="stage-info" :class="`stage-${currentStage}`">
            <div class="stage-label">{{ $t('eeg.stage.title') }} {{ currentStage }}</div>
            <div class="stage-countdown">{{ formattedCountdown }}</div>
          </div>
        </div>
        
        <!-- Stats overlay panel that will be positioned in top left of plot -->
        <div class="stats-overlay" v-if="eegStore.eegPlot.active">
          <div class="stats-header">{{ $t('eeg.stats.title') }}</div>
          <div class="stats-metrics">
            <div class="stats-metric" v-for="channel in channelsToShow" :key="channel">
              <div class="stats-metric-label">{{ channel.toUpperCase() }}</div>
              <div class="stats-metric-value" v-if="hasData(channel)">
                {{ getLatestValue(channel).toFixed(2) }}
                <div class="stats-metric-bar" :style="{width: getBarWidth(channel) + '%'}"></div>
              </div>
            </div>
            <div class="stats-metric-divider"></div>
            <!-- SNR Values -->
            <div class="stats-metric" v-for="channel in channelsToShow" :key="`snr-${channel}`">
              <div class="stats-metric-label">{{ channel.toUpperCase() }} {{ $t('eeg.stats.snr') }}</div>
              <div class="stats-metric-value">
                {{ (eegStore.sensorData.data.snr[channel] || 0).toFixed(1) }} dB
                <div class="stats-metric-bar snr-bar" 
                     :style="{width: getSnrBarWidth(channel) + '%'}"></div>
              </div>
            </div>
          </div>
        </div>
        <!-- Brain Scale Indicator Overlay -->
        <div v-if="eegStore.eegPlot.visualizationMode === '3d'" class="brain-scale-indicator">
          {{ $t('eeg.brainScale', { scale: eegStore.brainScaleText.split(' ')[1].replace('%', '') }) }}
        </div>
      </div>
      
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useEegStore } from '../stores/eegStore'
import { brainStore } from '../stores/brainStore'
import logger from '../utils/logger'
import { useDiagnosisStore } from '../stores/diagnosisStore'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

export default {
  name: 'EegVisualization',
  
  setup() {
    const eegStore = useEegStore()
    const diagnosisStore = useDiagnosisStore()
    const router = useRouter()
    const { t } = useI18n()
    const plotContainer = ref(null)
    
    // Component state
    const brainViewEnabled = ref(false)
    const isLoadingBrainModel = ref(false)
    const countdown = ref(0)
    let countdownInterval = null
    
    // Computed properties
    const channelsToShow = computed(() => {
      return eegStore.sensorData.channels.filter(ch => ch !== 'snr')
    })
    
    const currentStage = computed(() => {
      return eegStore.eegPlot.audio.currentStage
    })
    
    const formattedCountdown = computed(() => {
      const minutes = Math.floor(countdown.value / 60)
      const seconds = countdown.value % 60
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    })
    
    // Start countdown timer
    const startCountdown = () => {
      // Clear any existing interval
      stopCountdown()
      
      if (!eegStore.eegPlot.active) return
      
      const currentStageValue = eegStore.eegPlot.audio.currentStage
      const stageDuration = eegStore.eegPlot.audio.stageDurations[currentStageValue] / 1000 // Convert to seconds
      const stageStartTime = eegStore.eegPlot.audio.stageStartTime
      
      if (!stageDuration || !stageStartTime) return
      
      // Calculate initial countdown value
      const elapsedSeconds = Math.floor((Date.now() - stageStartTime) / 1000)
      countdown.value = Math.max(0, Math.floor(stageDuration - elapsedSeconds))
      
      // Set interval to update countdown every second
      countdownInterval = setInterval(() => {
        if (countdown.value > 0) {
          countdown.value -= 1
        } else {
          stopCountdown()
        }
      }, 1000)
    }
    
    // Stop countdown timer
    const stopCountdown = () => {
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
    }
    
    // Methods
    const hasData = (channel) => {
      return Array.isArray(eegStore.sensorData.data[channel]) && 
             eegStore.sensorData.data[channel].length > 0
    }
    
    const getLatestValue = (channel) => {
      if (!hasData(channel)) return 0
      return eegStore.sensorData.data[channel][eegStore.sensorData.data[channel].length - 1]
    }
    
    const getBarWidth = (channel) => {
      if (!hasData(channel)) return 0
      
      const value = getLatestValue(channel)
      // Normalize to 0-100% (assuming typical EEG range between -1 and 1)
      const normalized = Math.min(Math.max((value + 1) / 2 * 100, 0), 100)
      return normalized
    }
    
    const getSnrBarWidth = (channel) => {
      const snr = eegStore.sensorData.data.snr[channel] || 0
      // Normalize to 0-100% (assuming typical range between 0 and 20 dB)
      return Math.min(Math.max((snr / 20) * 100, 0), 100)
    }
    
    const formatTimestamp = (timestamp) => {
      if (!timestamp) return t('eeg.evaluation.notAvailable')
      
      try {
        const date = new Date(timestamp)
        return date.toLocaleString()
      } catch (e) {
        return timestamp
      }
    }
    
    const toggleEEGVisualization = () => {
      eegStore.toggleEEGVisualization()
      if (eegStore.eegPlot.active) {
        startCountdown()
      } else {
        stopCountdown()
      }
    }
    
    const evaluateEEG = async () => {
      const diagnosis = diagnosisStore.currentDiagnosis;
      if (!diagnosis) {
        logger.warn('No diagnosis selected for evaluation.');
        return;
      }
      await diagnosisStore.setCurrentDiagnosis(diagnosis);
      router.push({ path: '/predict' });
    };
    
    // Toggle brain visualization
    const toggleBrainMode = () => {
      if (isLoadingBrainModel.value) return
      
      brainViewEnabled.value = !brainViewEnabled.value
      
      if (brainViewEnabled.value) {
        loadBrainModel()
      } else {
        removeBrainModel()
      }
    }
    
    // Load the brain model
    const loadBrainModel = () => {
      if (isLoadingBrainModel.value) return
      
      isLoadingBrainModel.value = true
      
      // Get brain model path
      const brainModelPath = brainStore.models.brain
      if (!brainModelPath) {
        logger.warn('No brain model path available')
        isLoadingBrainModel.value = false
        brainViewEnabled.value = false
        return
      }
      
      logger.info('Loading brain model with path:', brainModelPath)
      
      // Check current mode and state
      const currentMode = eegStore.eegPlot.visualizationMode
      const isActive = eegStore.eegPlot.active
      
      if (currentMode !== '3d') {
        // Switch to 3D mode first
        eegStore.eegPlot.visualizationMode = '3d'
        eegStore.cleanupObjects()
        
        // Initialize with a delay to ensure vue updates
        setTimeout(() => {
          if (!eegStore.eegPlot.container && plotContainer.value) {
            eegStore.eegPlot.container = plotContainer.value
          }
          
          // If we're not actively recording data, use standalone mode
          if (!isActive) {
            // Use standalone mode for displaying the model without EEG data
            eegStore.displayBrainModelStandalone({ container: plotContainer.value })
            loadBrainModelAfterInitialization(brainModelPath)
          } else {
            // If recording, initialize regular visualization
            const initialized = eegStore.initializeVisualization(eegStore.eegPlot.container)
            
            if (initialized) {
              if (isActive) eegStore.startEEGVisualization()
              
              // Load model after initialization
              loadBrainModelAfterInitialization(brainModelPath)
            } else {
              logger.error('Failed to initialize 3D mode')
              isLoadingBrainModel.value = false
              brainViewEnabled.value = false
            }
          }
        }, 200)
      } else {
        // Already in 3D mode, just load the model
        loadBrainModelAfterInitialization(brainModelPath)
      }
    }
    
    // Helper function to load the model after initialization
    const loadBrainModelAfterInitialization = (modelPath) => {
      // Use the appropriate loading method based on whether we're recording
      const loadPromise = eegStore.eegPlot.active 
        ? eegStore.loadDetailedBrainModel(modelPath)
        : eegStore.loadBrainModelStandalone(modelPath)
      
      loadPromise
        .then(() => {
          logger.info('Brain model loaded successfully')
          isLoadingBrainModel.value = false
        })
        .catch((error) => {
          logger.error('Error loading brain model:', error.message)
          isLoadingBrainModel.value = false
          brainViewEnabled.value = false
        })
    }
    
    const removeBrainModel = () => {
      eegStore.removeDetailedBrainModel()
    }
    
    // Start EEG recording based on diagnosis store data
    const startRecordingFromStoreData = () => {
      if (!diagnosisStore.currentDiagnosis) {
        logger.warn('No current diagnosis set in diagnosisStore, cannot start EEG recording')
        return false
      }
      
      const diagnosisId = diagnosisStore.currentDiagnosis.diagnosis_id
      const diagnosisStage = diagnosisStore.currentDiagnosisStage || 1
      
      if (diagnosisId) {
        logger.info(`Starting EEG recording using store data: diagnosis ID: ${diagnosisId}, stage: ${diagnosisStage}`)
        
        // Start visualization with the stored parameters
        eegStore.startEEGVisualization({
          diagnosis_id: diagnosisId,
          diagnosis_stage: diagnosisStage
        })
        
        return true
      }
      
      return false
    }
    
    // Watch for stage changes
    watch(() => eegStore.eegPlot.audio.currentStage, (newStage, oldStage) => {
      if (newStage !== oldStage) {
        logger.info(`Stage changed from ${oldStage} to ${newStage}`)
        startCountdown()
      }
    })
    
    // Watch for active state changes
    watch(() => eegStore.eegPlot.active, (isActive) => {
      if (isActive) {
        startCountdown()
      } else {
        stopCountdown()
      }
    })
    
    // Lifecycle hooks
    onMounted(() => {
      // Make sure we're starting with the lines (2D) visualization mode
      eegStore.eegPlot.visualizationMode = 'lines';
      
      // Initialize the visualization
      if (!eegStore.eegPlot.container && plotContainer.value) {
        eegStore.eegPlot.container = plotContainer.value;
        eegStore.initializeVisualization(plotContainer.value);
      }

      // Add resize handler
      window.addEventListener('resize', eegStore.handleResize);

      // Start recording using the data from the stores
      if (!startRecordingFromStoreData()) {
        // Fallback to default behavior if no diagnosis data is available
        eegStore.startEEGVisualization();
      }

      // Trigger mock data generation if in mock mode
      if (eegStore.isMockMode) {
        const dataProcessor = eegStore.getDataProcessor(); // Ensure dataProcessor is initialized
        dataProcessor.startRecording(); // Call startRecording on the initialized instance
      }
      
      // Start countdown if EEG is already active
      if (eegStore.eegPlot.active) {
        startCountdown()
      }
      
      // Still set brainViewEnabled to true so we can toggle between views
      // but we don't actually load the model immediately
      brainViewEnabled.value = true;
    })
    
    onBeforeUnmount(() => {
      // Stop countdown timer
      stopCountdown()
      
      // Stop any ongoing visualization
      if (eegStore.eegPlot.active) {
        eegStore.stopEEGVisualization()
      }
      
      // Remove brain model if loaded
      if (brainViewEnabled.value) {
        removeBrainModel()
      }
      
      // Clean up resources
      eegStore.cleanupObjects()
      
      // Remove event listeners
      window.removeEventListener('resize', eegStore.handleResize)
    })
    
    const navigateToDiagnosis = () => {
      logger.info('Navigating to diagnosis selection page')
      router.push({ path: '/diagnosis' })
    }

    const toggleViewMode = () => {
      if (isLoadingBrainModel.value) return;
      
      // Set the loading state to prevent multiple rapid toggles
      isLoadingBrainModel.value = true;
      
      // Save current state values
      const isActive = eegStore.eegPlot.active;
      const currentMode = eegStore.eegPlot.visualizationMode;
      const newMode = currentMode === '3d' ? 'lines' : '3d';
      
      logger.info(`Toggling view mode from ${currentMode} to ${newMode}`);
      
      // Store reference to container if needed
      if (!eegStore.eegPlot.container && plotContainer.value) {
        eegStore.eegPlot.container = plotContainer.value;
      }
      
      // If EEG is active, we need to temporarily stop it for the transition
      let wasActive = false;
      if (isActive) {
        wasActive = true;
        eegStore.stopEEGVisualization();
      }
      
      // Switch visualization mode
      eegStore.eegPlot.visualizationMode = newMode;
      
      // Clean up current visualization objects
      eegStore.cleanupObjects();
      
      // Initialize the new visualization mode
      setTimeout(() => {
        // Initialize visualization with current container
        const initialized = eegStore.initializeVisualization(plotContainer.value);
        
        if (!initialized) {
          logger.error(`Failed to initialize ${newMode} visualization`);
          isLoadingBrainModel.value = false;
          return;
        }
        
        // Restart EEG if it was running
        if (wasActive) {
          eegStore.startEEGVisualization();
        } else if (newMode === '3d') {
          // In standalone mode, start the animation loop without data
          eegStore.displayBrainModelStandalone({ container: plotContainer.value });
        } else {
          // When switching back to line chart view without active recording,
          // we need to start the 2D animation loop manually
          const dataProcessor = eegStore.getDataProcessor();
          eegStore.get2dRenderer().startAnimationLoop(dataProcessor);
        }
        
        // If switching to 3D mode, reload the brain model
        if (newMode === '3d') {
          const brainModelPath = brainStore.models.brain;
          
          if (brainModelPath) {
            // Use appropriate loading method
            const loadPromise = wasActive
              ? eegStore.loadDetailedBrainModel(brainModelPath)
              : eegStore.loadBrainModelStandalone(brainModelPath);
              
            loadPromise
              .then(() => {
                logger.info('Brain model reloaded after view mode change');
                isLoadingBrainModel.value = false;
              })
              .catch((error) => {
                logger.error('Error reloading brain model:', error.message);
                isLoadingBrainModel.value = false;
              });
          } else {
            isLoadingBrainModel.value = false;
          }
        } else {
          isLoadingBrainModel.value = false;
        }
      }, 200); // Small delay to ensure UI updates before initialization
    }

    return {
      eegStore,
      diagnosisStore,
      plotContainer,
      brainViewEnabled,
      channelsToShow,
      currentStage,
      formattedCountdown,
      hasData,
      getLatestValue,
      getBarWidth,
      getSnrBarWidth,
      formatTimestamp,
      toggleEEGVisualization,
      toggleBrainMode,
      evaluateEEG,
      navigateToDiagnosis,
      toggleViewMode,
      isLoadingBrainModel
    }
  }
}
</script>

<style scoped>
.eeg-page {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.eeg-visualization {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.controls {
  margin-bottom: 1rem;
  display: flex;
  gap: 0.5rem;
  justify-content: space-between; /* Align buttons to the edges */
}

/* Base button styling to ensure consistent size */
.eeg-btn {
  padding: 10px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  min-width: 160px;
  text-align: center;
  font-size: 14px;
  transition: background-color 0.2s;
}

.eeg-btn:hover {
  background-color: #0056b3;
}

.controls button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.controls select {
  background-color: #2c3e50;
}

.metrics {
  display: flex;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.metric {
  padding: 8px 12px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-family: monospace;
}

.plot-container {
  flex: 1;
  min-height: 500px;
  background-color: #222222;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

/* Stats overlay panel styling */
.stats-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 180px;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 4px;
  color: white;
  z-index: 10;
  font-family: monospace;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  pointer-events: none; /* Allow interaction with the canvas beneath */
}

.stats-header {
  background-color: #4254b9; /* Using EEG component's blue color */
  padding: 5px 10px;
  font-size: 12px;
  font-weight: bold;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

.stats-metrics {
  padding: 10px;
}

.stats-metric {
  margin-bottom: 8px;
}

.stats-metric-label {
  font-size: 10px;
  opacity: 0.8;
  margin-bottom: 2px;
}

.stats-metric-value {
  font-size: 14px;
  position: relative;
  margin-bottom: 2px;
}

.stats-metric-bar {
  height: 3px;
  background: linear-gradient(to right, #4ECB71, #48BEFF, #FF6B6B);
  margin-top: 3px;
  border-radius: 1px;
  transition: width 0.3s ease-out;
}

.stats-metric-divider {
  height: 1px;
  background-color: rgba(255, 255, 255, 0.2);
  margin: 10px 0;
}

.snr-bar {
  background: linear-gradient(to right, #FF6B6B, #FFA94D, #4ECB71);
}

.brain-view-btn {
  background-color: #7742b9;
}

.brain-view-btn.active {
  background-color: #42b983;
}

.brain-view-btn:hover {
  background-color: #6331a8;
}

.brain-view-btn.active:hover {
  background-color: #35a46f;
}

.view-mode-btn {
  background-color: #ff9800;
}

.view-mode-btn:hover {
  background-color: #e68900;
}

/* Brain scale indicator overlay styling */
.brain-scale-indicator {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-family: monospace;
  z-index: 20;
}

/* Evaluation Results Popup Styles */
.evaluation-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.evaluation-popup {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  width: 500px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.evaluation-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #4254b9;
  color: white;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
}

.evaluation-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.evaluation-content {
  padding: 20px;
  flex: 1;
}

.result-summary {
  text-align: center;
  margin-bottom: 20px;
  padding: 15px;
  border-radius: 6px;
  background-color: #f5f5f5;
}

.result-label {
  font-size: 24px;
  font-weight: bold;
  color: #333;
  margin-bottom: 5px;
}

.result-probability {
  font-size: 18px;
  color: #666;
}

.result-details {
  margin-bottom: 20px;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
}

.detail-row {
  display: flex;
  padding: 10px 15px;
  border-bottom: 1px solid #eee;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row:nth-child(odd) {
  background-color: #f9f9f9;
}

.detail-label {
  flex: 1;
  font-weight: bold;
  color: #555;
}

.detail-value {
  flex: 2;
  color: #333;
}

.raw-output {
  margin-top: 15px;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 6px;
  background-color: #f9f9f9;
}

.raw-output h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 16px;
  color: #555;
}

.output-values {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.output-value {
  background-color: #eee;
  padding: 5px 10px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
}

.evaluation-actions {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  text-align: right;
}

.action-btn {
  padding: 8px 16px;
  background-color: #4254b9;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background-color: #3546a0;
}

.evaluate-eeg-btn {
  margin-left: auto; /* Push the button to the right */
  background-color: #28a745;
}

.evaluate-eeg-btn:hover {
  background-color: #218838;
}

.no-diagnosis-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000; /* Higher than other overlays */
}

.no-diagnosis-panel {
  background-color: white;
  border-radius: 8px;
  padding: 2rem;
  width: 90%;
  max-width: 500px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.overlay-actions {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

.primary-button {
  background-color: #3498db;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  border: none;
}

.primary-button:hover {
  background-color: #2980b9;
}

/* Stage overlay styling */
.stage-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
}

.stage-info {
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  color: white;
  padding: 12px 16px;
  font-family: monospace;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  text-align: center;
  min-width: 150px;
  pointer-events: none; /* Allow interaction with the canvas beneath */
  transition: all 0.3s ease;
}

.stage-label {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 5px;
}

.stage-countdown {
  font-size: 22px;
  font-weight: bold;
}

/* Different colors for each stage */
.stage-1 {
  background: linear-gradient(135deg, rgba(66, 84, 185, 0.8), rgba(19, 30, 92, 0.9));
  border-left: 4px solid #4254b9;
}
.stage-1 .stage-countdown {
  color: #78a9ff;
}

.stage-2 {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.8), rgba(27, 94, 32, 0.9));
  border-left: 4px solid #4CAF50;
}
.stage-2 .stage-countdown {
  color: #a5d6a7;
}

.stage-3 {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.8), rgba(230, 81, 0, 0.9));
  border-left: 4px solid #FF9800;
}
.stage-3 .stage-countdown {
  color: #ffcc80;
}

.stage-4 {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.8), rgba(183, 28, 28, 0.9));
  border-left: 4px solid #F44336;
}
.stage-4 .stage-countdown {
  color: #ef9a9a;
}
</style>
