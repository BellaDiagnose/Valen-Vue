<template>
  <div class="diagnosis-page">
    
    <!-- No Patient Selected Overlay -->
    <div v-if="!selectedPatient" class="no-patient-overlay">
      <div class="no-patient-panel">
        <h2>{{ $t('diagnosis.noPatientSelected') || 'No Patient Selected' }}</h2>
        <p>{{ $t('diagnosis.pleaseSelectPatient') || 'Please select a patient to view or create diagnoses' }}</p>
        
        <div class="overlay-actions">
          <button type="button" @click="navigateToPatientSelection" class="primary-button">
            {{ $t('diagnosis.goToPatientSelection') || 'Go to Patient Selection' }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- Diagnoses list for selected patient -->
    <div v-if="selectedPatient" class="diagnoses-section">
      <div class="diagnoses-header">
        <h3>{{ $t('diagnosis.diagnosesFor') }} {{ getPatientData(selectedPatient).name }}</h3>
        <button v-if="diagnosisStore.diagnoses.length > 0" @click="showCreateDiagnosisForm = true" class="new-diagnosis-button">
          <span class="add-icon">+</span> {{ $t('diagnosis.newDiagnosis') || 'New Diagnosis' }}
        </button>
      </div>
      
      <div v-if="diagnosisStore.loading" class="loading">
        {{ $t('common.loading') }}
      </div>
      
      <div v-else-if="diagnosisStore.diagnoses.length === 0" class="empty-state">
        <p>{{ $t('diagnosis.noDiagnoses') }}</p>
        <button @click="showCreateDiagnosisForm = true" class="primary-button">
          {{ $t('diagnosis.createFirstDiagnosis') || 'Create First Diagnosis' }}
        </button>
      </div>
      
      <div v-else class="diagnoses-list">
        <table>
          <thead>
            <tr>
              <th>{{ $t('diagnosis.fields.id') }}</th>
              <th>{{ $t('diagnosis.fields.date') }}</th>
              <th>{{ $t('diagnosis.fields.status') }}</th>
              <th>{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="diagnosis in diagnosisStore.diagnoses" :key="diagnosis.diagnosis_id">
              <td>{{ diagnosis.diagnosis_id }}</td>
              <td>{{ formatDate(diagnosis.created_at) }}</td>
              <td>
                <span :class="['status-badge', diagnosis.active_status ? 'active' : 'inactive']">
                  {{ diagnosis.active_status ? $t('patient.status.active') : $t('patient.status.inactive') }}
                </span>
              </td>
              <td>
                <button @click="showPredict(diagnosis)" class="action-button">
                  {{ $t('diagnosis.predict') || 'Predict' }}
                </button>
                <button @click="showEegDetails(diagnosis)" class="action-button">
                  {{ $t('diagnosis.details') || 'Details' }}
                </button>
                <button @click="startEEG(diagnosis)" class="action-button">
                  {{ $t('diagnosis.record') || 'Record' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Create Diagnosis Form -->
    <div v-if="showCreateDiagnosisForm && selectedPatient" class="diagnosis-form-overlay">
      <div class="diagnosis-form">
        <h2>{{ $t('diagnosis.newDiagnosis') }}</h2>
        <p>{{ $t('diagnosis.confirmCreation') }} {{ getPatientData(selectedPatient).name }}?</p>
        
        <div class="form-actions">
          <button type="button" @click="showCreateDiagnosisForm = false" class="cancel-button">
            {{ $t('common.cancel') }}
          </button>
          <button type="button" @click="addDiagnosis" class="submit-button" :disabled="diagnosisStore.loading">
            {{ $t('common.create') }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- Error message display -->
    <div v-if="diagnosisStore && diagnosisStore.error" class="error-message">
      {{ diagnosisStore.error }}
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { usePatientStore } from '../stores/patientStore'
import { useDiagnosisStore } from '../stores/diagnosisStore'
import { useRouter } from 'vue-router'
import logger from '../utils/logger'

export default {
  name: 'DiagnosisPage',
  setup() {
    const patientStore = usePatientStore()
    const diagnosisStore = useDiagnosisStore()
    const router = useRouter()
    
    const selectedPatient = ref(null)
    const showCreateDiagnosisForm = ref(false)
    const currentStage = ref(1)
    
    // Initialize the page
    onMounted(async () => {
      // Check if we already have a patient in diagnosisStore or patientStore
      if (patientStore.currentPatient) {
        await selectPatient(patientStore.currentPatient)
      } else {
        await refreshPatients()
      }
    })
    
    const refreshPatients = async () => {
      await patientStore.fetchActivePatients()
      
      // If there's a current patient in the store, select it
      if (patientStore.currentPatient) {
        await selectPatient(patientStore.currentPatient)
      }
    }
    
    const selectPatient = async (patient) => {
      selectedPatient.value = patient
      
      // Set the selected patient in patientStore
      patientStore.currentPatient = patient
      
      await refreshDiagnoses()
    }
    
    const refreshDiagnoses = async () => {
      if (selectedPatient.value) {
        // Fetch diagnoses for the selected patient
        await diagnosisStore.fetchDiagnosesForPatient();
        logger.info(`Fetched ${diagnosisStore.diagnoses.length} diagnoses for patient: ${selectedPatient.value.patient_id}`);
      }
    };
    
    const formatDate = (dateString) => {
      try {
        const date = new Date(dateString)
        return date.toLocaleString()
      } catch (e) {
        return dateString
      }
    }
    
    const addDiagnosis = async () => {
      // The diagnosisStore will use the current patient from patientStore
      const success = await diagnosisStore.addDiagnosis()
      
      if (success) {
        showCreateDiagnosisForm.value = false
        // Refresh the list after a short delay to ensure backend has processed
        setTimeout(() => {
          refreshDiagnoses()
        }, 1000)
      }
    }
    
    const startEEG = async (diagnosis) => {
      await diagnosisStore.setCurrentDiagnosis(diagnosis);
      router.push({ path: '/eeg' });
    };
    
    const showPredict = async (diagnosis) => {
      await diagnosisStore.setCurrentDiagnosis(diagnosis);
      router.push({ path: '/predict' });
    };
    
    const showEegDetails = async (diagnosis) => {
      await diagnosisStore.setCurrentDiagnosis(diagnosis);
      router.push({ path: '/eeg/details' });
    };

    // Add a method to navigate to the patient selection page
    const navigateToPatientSelection = () => {
      logger.info('Navigating to patient selection page')
      router.push({ path: '/patient' })
    }

    const getPatientData = (patient) => {
      try {
        return JSON.parse(patient.raw_data);
      } catch (e) {
        return { name: 'Unknown', gender: 'Unknown', age: 0 };
      }
    };

    return {
      patientStore,
      diagnosisStore,
      selectedPatient,
      showCreateDiagnosisForm,
      currentStage,
      selectPatient,
      refreshDiagnoses,
      formatDate,
      addDiagnosis,
      startEEG,
      showPredict,
      showEegDetails,
      navigateToPatientSelection,
      getPatientData,
    }
  }
}
</script>

<style scoped>
.diagnosis-page {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.diagnosis-controls {
  margin-bottom: 1rem;
  display: flex;
  gap: 0.5rem;
}

button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  border: none;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary-button {
  background-color: #3498db;
  color: white;
}

.secondary-button {
  background-color: #e0e0e0;
  color: #333;
}

.action-button {
  background-color: transparent;
  color: #3498db;
  padding: 0.25rem 0.5rem;
  font-size: 0.9rem;
  margin-right: 0.25rem;
}

.patient-selection {
  margin-top: 1rem;
  margin-bottom: 2rem;
}

.patient-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.patient-item {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.2s;
}

.patient-item:hover {
  background-color: #f5f5f5;
}

.patient-item.selected {
  background-color: #3498db;
  color: white;
  border-color: #3498db;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

th {
  font-weight: bold;
  background-color: #f5f5f5;
}

.stage-indicator {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #e0e0e0;
  color: #333;
  text-align: center;
  line-height: 24px;
  margin-right: 0.5rem;
}

.stage-indicator.complete {
  background-color: #2ecc71;
  color: white;
}

.diagnosis-form-overlay,
.recording-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; /* Increased z-index to appear above navigation */
}

.diagnosis-form,
.recording-panel {
  background-color: white;
  border-radius: 8px;
  padding: 2rem;
  width: 90%;
  max-width: 600px;
}

.form-actions,
.recording-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.cancel-button,
.close-button {
  background-color: #e0e0e0;
  color: #333;
}

.submit-button {
  background-color: #2ecc71;
  color: white;
}

.stage-selection {
  margin: 1.5rem 0;
}

.stage-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.stage-button {
  flex: 1;
  background-color: #e0e0e0;
  color: #333;
}

.stage-button.active {
  background-color: #3498db;
  color: white;
}

.recording-controls {
  display: flex;
  gap: 0.5rem;
  margin: 1.5rem 0;
}

.start-button {
  background-color: #2ecc71;
  color: white;
  flex: 1;
}

.stop-button {
  background-color: #e74c3c;
  color: white;
  flex: 1;
}

.evaluate-button {
  background-color: #f39c12;
  color: white;
  flex: 1;
}

.loading, .empty-state {
  margin-top: 1rem;
  text-align: center;
  color: #666;
}

.error-message {
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
}

.no-patient-overlay {
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

.no-patient-panel {
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

.diagnoses-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.new-diagnosis-button {
  background-color: #2ecc71;
  color: white;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.add-icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 500;
  display: inline-block;
}

.status-badge.active {
  background-color: #d4edda;
  color: #155724;
}

.status-badge.inactive {
  background-color: #f8d7da;
  color: #721c24;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  border: 1px dashed #ccc;
  border-radius: 8px;
  margin-top: 1rem;
}

.empty-state p {
  margin-bottom: 1rem;
}

.results-display {
  margin-top: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1rem;
}

.results-content {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 4px;
  max-height: 200px;
  overflow: auto;
}
</style>