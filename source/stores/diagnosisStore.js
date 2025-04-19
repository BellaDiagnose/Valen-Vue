import { defineStore } from 'pinia'
import { useAdminStore } from './adminStore'
import { usePatientStore } from './patientStore'
import logger from '../utils/logger.js'
import { mockCreateDiagnosis, mockFetchDiagnosesForPatient } from '../mock.js'

export const useDiagnosisStore = defineStore('diagnosis', {
  state: () => ({
    diagnoses: [],
    currentDiagnosis: null,
    currentDiagnosisStage: 1, // Added centralized diagnosis stage management
    loading: false,
    error: null
  }),
  
  getters: {
    getDiagnoses: (state) => state.diagnoses,
    getCurrentDiagnosis: (state) => state.currentDiagnosis,
    isLoading: (state) => state.loading,
    currentAdminId() {
      const adminStore = useAdminStore();
      return adminStore.adminId;
    },
    currentPatientId() {
      const patientStore = usePatientStore();
      return patientStore.currentPatient?.patient_id;
    },
    // Add getter for diagnosis stage
    getCurrentDiagnosisStage: (state) => state.currentDiagnosisStage
  },
  
  actions: {
    async addDiagnosis() {
      try {
        this.loading = true;
        this.error = null;
        
        const adminStore = useAdminStore();
        const adminId = adminStore.adminId;
        
        const patientStore = usePatientStore();
        const patientId = patientStore.currentPatient?.patient_id;
        
        if (!patientId) {
          throw new Error('No patient selected for diagnosis');
        }
        
        if (window.bellaBridge?.isMockMode) {
          logger.info('Using mock implementation for createDiagnosis');
          const newDiagnosis = mockCreateDiagnosis(adminId, patientId);
          this.diagnoses.push(newDiagnosis);
          this.currentDiagnosis = newDiagnosis;
          this.currentDiagnosisStage = 1; // Reset stage for new diagnosis
          return true;
        }
        
        logger.info(`Creating new diagnosis record for patient: ${patientId}`);
        
        const success = await window.bellaBridge.calls.cppBackend('record', {
          table: 'diagnosis',
          operation: 'add',
          data: {
            admin_id: adminId,
            patient_id: patientId
          }
        });
        
        if (success) {
          logger.info('Diagnosis creation request sent successfully');
          this.currentDiagnosisStage = 1; // Reset stage for new diagnosis
          return true;
        } else {
          throw new Error('Failed to send diagnosis data to backend');
        }

      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Diagnosis Creation Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    async fetchDiagnosesForPatient() {
      try {
        this.loading = true;
        this.error = null;
        
        const patientStore = usePatientStore();
        const patientId = patientStore.currentPatient?.patient_id;
        
        if (!patientId) {
          throw new Error('No patient selected for fetching diagnoses');
        }
        
        if (window.bellaBridge?.isMockMode) {
          logger.info('Using mock implementation for fetchDiagnosesForPatient');
          this.diagnoses = mockFetchDiagnosesForPatient(patientId);
          return true;
        }
        
        if (window.bellaBridge) {
          logger.info(`Fetching diagnoses for patient: ${patientId}`);
          
          const success = await window.bellaBridge.calls.cppBackend('record', {
            table: 'diagnosis',
            operation: 'read',
            data: {
              patient_id: patientId
            }
          });
          
          if (!success) {
            throw new Error('Failed to fetch diagnoses');
          }
          
          logger.info('Diagnoses request sent successfully');
          return true;
        } else {
          logger.info('Using mock implementation for fetchDiagnosesForPatient');
          this.diagnoses = this.diagnoses.filter(d => d.patient_id === patientId);
          return true;
        }
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Fetch Diagnoses Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    async setCurrentDiagnosis(diagnosis) {
      if (!diagnosis || !diagnosis.diagnosis_id) {
        logger.warn('Attempted to set invalid diagnosis');
        return false;
      }
      
      this.currentDiagnosis = diagnosis;
      this.currentDiagnosisStage = 1; // Reset stage when changing diagnosis
      logger.info(`Set current diagnosis ID: ${diagnosis.diagnosis_id}, reset stage to 1`);
      return true;
    },

    // Add new method to update diagnosis stage
    updateDiagnosisStage(stage) {
      if (typeof stage !== 'number' || stage < 1) {
        logger.warn(`Invalid diagnosis stage: ${stage}`);
        return false;
      }
      
      // Update local stage
      this.currentDiagnosisStage = stage;
      logger.info(`Updated diagnosis stage to: ${stage}`);
      
      // If we have a diagnosis ID and bridge is available, notify the backend
      if (this.currentDiagnosis?.diagnosis_id && window.bellaBridge?.calls) {
        const diagnosisId = this.currentDiagnosis.diagnosis_id;
        
        logger.info(`Notifying backend of stage change to ${stage} for diagnosis ID ${diagnosisId}`);
        
        window.bellaBridge.calls.cppBackend('sensor', {
          sensor: "ads1299",
          action: "stage",
          diagnosis_id: diagnosisId,
          diagnosis_stage: stage
        });
      }
      
      return true;
    },
    
    // Method to handle evaluation results from C++ backend
    updateEegEvaluation(evaluationResult) {
      if (!evaluationResult) {
        logger.warn('Received invalid evaluation result');
        return false;
      }
      
      logger.info(`Processing EEG evaluation for diagnosis ID ${evaluationResult.diagnosis_id}, stage ${evaluationResult.diagnosis_stage}`);
      
      // Additional processing can be added here...
      
      return true;
    },
    
    // New method to handle diagnosis data from C++ backend
    async updateDiagnosisData(diagnosisData) {
      try {
        // Check if the response contains a records array (response from getDiagnosesByPatient)
        if (diagnosisData && diagnosisData.records && Array.isArray(diagnosisData.records)) {
          logger.info(`Received ${diagnosisData.records.length} diagnosis records from backend`);
          
          // Update the diagnoses array with the records
          this.diagnoses = diagnosisData.records;
          
          // If there are any records, set the first one as current if none is selected
          if (diagnosisData.records.length > 0 && !this.currentDiagnosis) {
            this.currentDiagnosis = diagnosisData.records[0];
            this.currentDiagnosisStage = 1;
          }
          
          return true;
        }
        
        // For single diagnosis response (insert or update operation)
        if (diagnosisData && diagnosisData.diagnosis_id) {
          // If this is a newly created diagnosis
          if (diagnosisData.success) {
            logger.info(`Successfully processed diagnosis ID: ${diagnosisData.diagnosis_id}`);
            
            // Create a complete diagnosis object
            const newDiagnosis = {
              diagnosis_id: diagnosisData.diagnosis_id,
              patient_id: diagnosisData.patient_id,
              admin_id: diagnosisData.admin_id,
              active_status: diagnosisData.active_status !== undefined ? diagnosisData.active_status : true,
              created_at: diagnosisData.created_at || Math.floor(Date.now() / 1000),
              is_valid: true
            };
            
            // Add to diagnoses array if it doesn't exist
            const existingIndex = this.diagnoses.findIndex(d => d.diagnosis_id === newDiagnosis.diagnosis_id);
            if (existingIndex === -1) {
              this.diagnoses.push(newDiagnosis);
            } else {
              // Update existing diagnosis
              this.diagnoses[existingIndex] = {
                ...this.diagnoses[existingIndex],
                ...newDiagnosis
              };
            }
            
            // Update current diagnosis reference
            this.currentDiagnosis = newDiagnosis;
            this.currentDiagnosisStage = 1; // Reset stage for new/updated diagnosis
            
            return true;
          }
        }
        
        // If we get here, log a warning about unhandled data format
        logger.warn(`Received diagnosis data in unexpected format: ${JSON.stringify(diagnosisData)}`);
        return false;
        
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Diagnosis Update Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    }
  }
})