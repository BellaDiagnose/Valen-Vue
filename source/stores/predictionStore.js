import { defineStore } from 'pinia'
import { useDiagnosisStore } from './diagnosisStore'
import logger from '../utils/logger.js'
import { mockFetchPredictionById, mockFetchPredictionsByDiagnosis } from '../mock.js'

export const usePredictionStore = defineStore('prediction', {
  state: () => ({
    predictions: [],
    currentPrediction: null,
    predictionId: null,
    loading: false,
    error: null
  }),
  
  getters: {
    getPredictions: (state) => state.predictions,
    getCurrentPrediction: (state) => state.currentPrediction,
    isLoading: (state) => state.loading
  },
  
  actions: {
    setPredictionId(id) {
      this.predictionId = id;
      if (id && this.predictions.length > 0) {
        const prediction = this.predictions.find(p => p.prediction_id === id);
        if (prediction) {
          this.currentPrediction = prediction;
        }
      }
    },
    
    async fetchPredictionById(predictionId) {
      try {
        this.loading = true;
        this.error = null;
        
        if (!predictionId) {
          throw new Error('Prediction ID is required');
        }

        if (window.bellaBridge?.isMockMode) {
          logger.info(`Using mock implementation for fetchPredictionById: ${predictionId}`);
          const prediction = mockFetchPredictionById(predictionId);
          
          if (prediction) {
            setTimeout(() => {
              this.updatePredictionData(prediction);
            }, 200);
            return true;
          }
          
          throw new Error('Mock prediction not found');
        }
        
        if (window.bellaBridge && window.bellaBridge.calls) {
          logger.info(`Fetching prediction with ID: ${predictionId}`);
          
          const success = window.bellaBridge.calls.cppBackend('record', {
            table: 'prediction',
            operation: 'read',
            data: { 
              prediction_id: predictionId
            }
          });
          
          if (success) {
            logger.info('Prediction fetch request sent successfully');
            return true;
          } else {
            throw new Error('Failed to fetch prediction data');
          }
        } else {
          logger.warn('Native bridge not available for prediction lookup');
          return false;
        }
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Prediction Fetch Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    async fetchPredictionsByDiagnosis(diagnosisId) {
      try {
        this.loading = true;
        this.error = null;
        
        if (!diagnosisId) {
          const diagnosisStore = useDiagnosisStore();
          diagnosisId = diagnosisStore.currentDiagnosis?.diagnosis_id;
          if (!diagnosisId) {
            throw new Error('Diagnosis ID is required');
          }
        }
        
        if (window.bellaBridge?.isMockMode) {
          logger.info(`Using mock implementation for fetchPredictionsByDiagnosis: ${diagnosisId}`);
          const predictions = mockFetchPredictionsByDiagnosis(diagnosisId);
          
          setTimeout(() => {
            this.updatePredictionData(predictions);
          }, 200);
          
          return true;
        }
        
        if (window.bellaBridge && window.bellaBridge.calls) {
          logger.info(`Fetching predictions for diagnosis ID: ${diagnosisId}`);
          
          const success = window.bellaBridge.calls.cppBackend('record', {
            table: 'prediction',
            operation: 'read',
            data: { 
              diagnosis_id: diagnosisId
            }
          });
          
          if (success) {
            logger.info('Predictions fetch request sent successfully');
            return true;
          } else {
            throw new Error('Failed to fetch predictions');
          }
        } else {
          logger.warn('Native bridge not available for predictions fetch');
          return false;
        }
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Predictions Fetch Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    // Handle prediction data received from C++ backend
    updatePredictionData(predictionData) {
      logger.info(`Received prediction data: ${typeof predictionData === 'object' ? 'object' : predictionData}`);
      
      try {
        if (!predictionData || typeof predictionData !== 'object') {
          throw new Error('Invalid prediction data received');
        }
        
        // Determine if this is a response from an operation or actual prediction data
        if (predictionData.success !== undefined) {
          // This is a response from an operation
          if (predictionData.success && predictionData.prediction_id) {
            this.predictionId = predictionData.prediction_id;
            logger.info(`Set current prediction ID to: ${this.predictionId}`);
            
            // Fetch the actual prediction data now that we have the ID
            this.fetchPredictionById(predictionData.prediction_id);
          }
        } else {
          // This is a single prediction
          if (typeof predictionData.raw_output === 'string') {
            try {
              predictionData.raw_output = predictionData.raw_output.split(',').map(Number);
            } catch (e) {
              logger.error('Failed to parse raw_output string to array', e);
              predictionData.raw_output = [];
            }
          }
          
          // Ensure the prediction has the expected structure
          const formattedPrediction = {
            ...predictionData,
            result: {
              raw_output: predictionData.raw_output || [],
              label: predictionData.label || 'Unknown',
              probability: predictionData.probability || 0
            },
            predictionId: predictionData.prediction_id,
            diagnosisId: predictionData.diagnosis_id,
            diagnosisStage: predictionData.diagnosis_stage || 1,
            numRecords: predictionData.num_records || 0,
            timestamp: predictionData.created_at
          };
          
          this.currentPrediction = formattedPrediction;
          this.predictionId = predictionData.prediction_id;
          
          // Add to the list if not already there
          if (!this.predictions.some(p => p.prediction_id === predictionData.prediction_id)) {
            this.predictions.push(formattedPrediction);
          }
          
          logger.info(`Updated prediction with ID: ${predictionData.prediction_id}`);
        }
        return true;
      } catch (error) {
        logger.error('Error processing prediction data:', error);
        this.error = error.message;
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    // Clear predictions 
    clearPredictions() {
      this.predictions = [];
      this.currentPrediction = null;
      this.predictionId = null;
      this.error = null;
    }
  }
});