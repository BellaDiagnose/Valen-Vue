import { defineStore } from 'pinia'
import { useAdminStore } from './adminStore'
import logger from '../utils/logger.js'
import { mockAddPatient, mockUpdatePatientStatus, mockFetchActivePatients } from '../mock.js'

export const usePatientStore = defineStore('patient', {
  state: () => ({
    patients: [],
    activePatients: [],
    loading: false,
    error: null,
    currentPatient: null
  }),
  
  getters: {
    getPatients: (state) => state.patients,
    getActivePatients: (state) => state.activePatients,
    isLoading: (state) => state.loading,
    currentAdminId() {
      const adminStore = useAdminStore();
      return adminStore.adminId;
    }
  },
  
  actions: {
    async addPatient(patientData) {
      try {
        this.loading = true;
        this.error = null;

        if (window.bellaBridge?.isMockMode) {
          logger.info('Using mock implementation for addPatient');
          const newPatient = mockAddPatient(patientData);
          this.patients.push(newPatient);
          return true;
        }
        
        const adminStore = useAdminStore();
        if (!patientData.admin_id) {
          const patientDataObj = JSON.parse(patientData.raw_data || '{}');
          patientDataObj.admin_id = adminStore.adminId;
          patientData.raw_data = JSON.stringify(patientDataObj);
        }
        
        if (window.bellaBridge) {
          logger.info('Sending addPatient request to C++ backend');
          
          const success = window.bellaBridge.calls.cppBackend('record', {
            table: 'patient',
            operation: 'add',
            data: patientData
          });
          
          if (success) {
            logger.info('Patient add request sent successfully');
            return true;
          } else {
            throw new Error('Failed to send patient data to backend');
          }
        } else {
          logger.info('Using mock implementation for addPatient');
          this.patients.push({
            patient_id: Date.now(),
            ...patientData,
            created_at: new Date().toISOString()
          });
          return true;
        }
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Patient Add Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    async updatePatientStatus(patientId, status) {
      try {
        this.loading = true;
        this.error = null;

        if (window.bellaBridge?.isMockMode) {
          logger.info('Using mock implementation for updatePatientStatus');
          return mockUpdatePatientStatus(patientId, status);
        }
        
        if (window.bellaBridge) {
          logger.info(`Updating patient status: ${patientId} to ${status}`);
          
          const success = window.bellaBridge.calls.cppBackend('record', {
            table: 'patient',
            operation: 'update',
            data: { 
              patient_id: patientId, 
              status: status 
            }
          });
          
          if (success) {
            logger.info('Patient status update request sent successfully');
            const patientIndex = this.patients.findIndex(p => p.patient_id === patientId);
            if (patientIndex >= 0) {
              this.patients[patientIndex].active_status = status;
            }
            return true;
          } else {
            throw new Error('Failed to update patient status');
          }
        } else {
          const patientIndex = this.patients.findIndex(p => p.patient_id === patientId);
          if (patientIndex >= 0) {
            this.patients[patientIndex].active_status = status;
          }
          return true;
        }
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Patient Status Update Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    async fetchActivePatients() {
      try {
        this.loading = true;
        this.error = null;

        if (window.bellaBridge?.isMockMode) {
          logger.info('Using mock implementation for fetchActivePatients');
          this.activePatients = mockFetchActivePatients();
          return true;
        }
        
        const adminStore = useAdminStore();
        const adminId = adminStore.adminId;
        
        if (window.bellaBridge) {
          logger.info('Fetching active patients from C++ backend');
          
          const success = window.bellaBridge.calls.cppBackend('record', {
            table: 'patient',
            operation: 'read',
            data: {
              admin_id: adminId,
              status: 'active'
            }
          });
          
          if (!success) {
            throw new Error('Failed to fetch active patients');
          }
          
          logger.info('Active patients request sent successfully');
          return true;
        } else {
          logger.info('Using mock implementation for fetchActivePatients');
          this.activePatients = this.patients.filter(p => p.active_status);
          return true;
        }
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Fetch Active Patients Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    // Method to handle patient data from C++ backend, similar to the diagnosisStore pattern
    async updatePatientData(patientData) {
      try {
        // Case 1: List of patients (from fetchActivePatients)
        if (Array.isArray(patientData)) {
          logger.info(`Received ${patientData.length} active patients from backend`);
          this.activePatients = patientData;
          return true;
        }
        
        // Case 2: Single patient response (from add or update operation)
        if (patientData && typeof patientData === 'object') {
          // Check if this is a response from an operation (has success property)
          if (patientData.success !== undefined) {
            logger.info('Received patient operation response:', patientData);
            
            if (patientData.success && patientData.patient_id) {
              logger.info(`Successfully processed patient ID: ${patientData.patient_id}`);
              
              // For successful operations, refresh the patient list immediately
              try {
                await this.fetchActivePatients();
                // Log the count of active patients after refresh for debugging
                logger.info(`After refresh: ${this.activePatients.length} active patients`);
              } catch (refreshError) {
                logger.error({
                  title: 'Patient Refresh Error',
                  message: refreshError.message
                });
              }
              return true;
            } else {
              // If operation failed, set error
              this.error = patientData.error || 'Unknown error processing patient';
              return false;
            }
          }
          
          // Case 3: Single patient object 
          if (patientData.patient_id) {
            logger.info(`Received single patient data: ${patientData.patient_id}`);
            
            // Find if patient already exists in list
            const existingIndex = this.activePatients.findIndex(p => p.patient_id === patientData.patient_id);
            
            // Update or add patient to list
            if (existingIndex >= 0) {
              this.activePatients[existingIndex] = patientData;
            } else {
              this.activePatients.push(patientData);
            }
            return true;
          }
        }
        
        // If we get here, log a warning about unhandled data format
        logger.warn(`Received patient data in unexpected format:`, patientData);
        return false;
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Patient Data Update Error',
          message: error.message
        });
        return false;
      }
    }
  }
})