<template>
  <div class="predict-page">

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
    
    <div class="prediction-content" v-else>
      <div class="result-summary" v-if="predictionStore.currentPrediction">
        <div class="result-label">{{ predictionStore.currentPrediction.result.label }}</div>
        <div class="result-probability">
          {{ (predictionStore.currentPrediction.result.probability * 100).toFixed(1) }}% certainty
        </div>
      </div>
      
      <div class="result-details" v-if="predictionStore.currentPrediction">
        <div class="detail-row">
          <span class="detail-label">Diagnosis ID:</span>
          <span class="detail-value">{{ predictionStore.currentPrediction.diagnosisId }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Stage:</span>
          <span class="detail-value">{{ predictionStore.currentPrediction.diagnosisStage }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Records Analyzed:</span>
          <span class="detail-value">{{ predictionStore.currentPrediction.numRecords }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Prediction ID:</span>
          <span class="detail-value">{{ predictionStore.currentPrediction.predictionId || 'N/A' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Timestamp:</span>
          <span class="detail-value">{{ formatTimestamp(predictionStore.currentPrediction.timestamp) }}</span>
        </div>
      </div>
      
      <div v-if="predictionStore.currentPrediction && predictionStore.currentPrediction.result.raw_output.length > 0" class="raw-output">
        <h3>Raw Prediction Output</h3>
        <div class="output-values">
          <div v-for="(value, index) in predictionStore.currentPrediction.result.raw_output" :key="index" class="output-value">
            Class {{ index }}: {{ value.toFixed(4) }}
          </div>
        </div>
      </div>
      
      <!-- New navigation buttons -->
      <div class="action-buttons">
        <button @click="navigateToSurvey" class="action-button survey-button">
          {{ $t('predict.goToSurvey') || 'Go to Survey' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { usePredictionStore } from '../stores/predictionStore'
import { useDiagnosisStore } from '../stores/diagnosisStore'
import { onMounted, ref } from 'vue'
import logger from '../utils/logger.js'
import { useRouter } from 'vue-router'

export default {
  name: 'PredictView',
  
  setup() {
    const predictionStore = usePredictionStore()
    const diagnosisStore = useDiagnosisStore()
    const loading = ref(false)
    const router = useRouter()

    onMounted(async () => {
      loading.value = true
      
      try {
        if (diagnosisStore.currentDiagnosis) {
          const diagnosisId = diagnosisStore.currentDiagnosis.diagnosis_id
          logger.info(`Loading predictions for diagnosis ID: ${diagnosisId}`)
          
          await predictionStore.fetchPredictionsByDiagnosis(diagnosisId)
          
          if (predictionStore.predictions.length > 0) {
            const mostRecent = predictionStore.predictions.reduce((latest, current) => {
              return current.created_at > latest.created_at ? current : latest
            }, predictionStore.predictions[0])
            
            predictionStore.setPredictionId(mostRecent.prediction_id)
            logger.info(`Automatically selected most recent prediction ID: ${mostRecent.prediction_id}`)
          } else {
            logger.info(`No predictions found for diagnosis ID: ${diagnosisId}`)
          }
        } else {
          logger.warn('No current diagnosis available')
        }
        
        // Register handler for EEG evaluation results
        if (window.bellaBridge?.handlers) {
          window.bellaBridge.handlers.displayEEGEvaluation = processEvaluationResults
          logger.info('Registered displayEEGEvaluation handler')
        }
      } catch (error) {
        logger.error('Error initializing prediction view', error)
      } finally {
        loading.value = false
      }
    })
    
    // Process evaluation results from backend
    const processEvaluationResults = (data) => {
      if (!data || !data.prediction) {
        logger.error('Invalid evaluation results data')
        return false
      }
      
      logger.info(`Processing EEG evaluation results for diagnosis ID: ${data.diagnosis_id}, stage: ${data.diagnosis_stage}`)
      
      // Update the evaluation results using the exact format from the example
      const formattedPrediction = {
        diagnosisId: data.diagnosis_id,
        diagnosisStage: data.diagnosis_stage,
        predictionId: data.prediction_id || null,
        result: {
          label: data.prediction.label || '',
          probability: data.prediction.probability || 0,
          raw_output: data.prediction.raw_output || []
        },
        numRecords: data.num_records || 0,
        timestamp: new Date().toISOString()
      }
      
      // Set as current prediction in the prediction store
      predictionStore.currentPrediction = formattedPrediction
      
      logger.debug('Updated current prediction with evaluation results')
      return true
    }
    
    const formatTimestamp = (timestamp) => {
      if (!timestamp) return ''
      const date = new Date(typeof timestamp === 'number' ? timestamp * 1000 : new Date(timestamp).getTime())
      return date.toLocaleString()
    }
    
    const navigateToDiagnosis = () => {
      logger.info('Navigating to diagnosis selection page')
      router.push({ path: '/diagnosis' })
    }
    
    // New method to navigate to the survey page
    const navigateToSurvey = () => {
        logger.info(`Navigating to survey`)
        router.push({path: '/survey' })
    }

    return {
      predictionStore,
      diagnosisStore,
      formatTimestamp,
      navigateToDiagnosis,
      navigateToSurvey
    }
  }
}
</script>

<style scoped>
.predict-page {
  max-width: 1200px;
  margin: 0 auto;
}

.prediction-header {
  margin-bottom: 20px;
}

.prediction-content {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.loading-indicator {
  text-align: center;
  padding: 40px 0;
}

.result-summary {
  margin-bottom: 20px;
  padding: 15px;
  background-color: white;
  border-radius: 8px;
  text-align: center;
}

.result-label {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
}

.result-probability {
  font-size: 18px;
  color: #666;
}

.result-details {
  margin-bottom: 30px;
}

.detail-row {
  display: flex;
  padding: 10px;
  border-bottom: 1px solid #ddd;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: bold;
  width: 150px;
  flex-shrink: 0;
}

.detail-value {
  flex-grow: 1;
}

.raw-output {
  margin-top: 30px;
  padding: 15px;
  background-color: white;
  border-radius: 8px;
}

.raw-output h3 {
  margin-top: 0;
  margin-bottom: 15px;
}

.output-value {
  margin-bottom: 8px;
}

.predictions-list {
  margin-bottom: 30px;
}

.prediction-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 15px;
}

.prediction-item {
  background-color: white;
  padding: 15px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.prediction-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
}

.prediction-item-header {
  font-weight: bold;
  margin-bottom: 10px;
}

.prediction-item-date {
  font-size: 14px;
  color: #666;
}

.no-prediction {
  text-align: center;
  padding: 40px 0;
}

.no-diagnosis-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.no-diagnosis-panel {
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.no-diagnosis-panel h2 {
  margin-bottom: 15px;
}

.no-diagnosis-panel p {
  margin-bottom: 20px;
}

.overlay-actions .primary-button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.overlay-actions .primary-button:hover {
  background-color: #0056b3;
}
</style>
