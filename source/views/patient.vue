<template>
  <div class="patient-page">
    
    <div class="patient-controls">
      <button @click="showAddPatientForm = true" class="primary-button">
        <span class="add-icon">+</span> {{ $t('patient.add') }}
      </button>
      <button @click="refreshPatients" class="secondary-button">
        {{ $t('patient.refresh') }}
      </button>
    </div>
    
    <!-- Add Patient Form -->
    <div v-if="showAddPatientForm" class="patient-form-overlay">
      <div class="patient-form">
        <h2>{{ $t('patient.newPatient') }}</h2>
        <form @submit.prevent="addPatient">
          <div class="form-group">
            <label for="name">{{ $t('patient.fields.name') }}</label>
            <input type="text" id="name" v-model="newPatient.name" required>
          </div>
          
          <div class="form-group">
            <label for="gender">{{ $t('patient.fields.gender') }}</label>
            <select id="gender" v-model="newPatient.gender" required>
              <option value="male">{{ $t('patient.genders.male') }}</option>
              <option value="female">{{ $t('patient.genders.female') }}</option>
              <option value="other">{{ $t('patient.genders.other') }}</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="age">{{ $t('patient.fields.age') }}</label>
            <input type="number" id="age" v-model.number="newPatient.age" min="0" max="150" required>
          </div>
          
          <div class="form-group">
            <label for="notes">{{ $t('patient.fields.notes') }}</label>
            <textarea id="notes" v-model="newPatient.notes" rows="3"></textarea>
          </div>
          
          <div class="form-actions">
            <button type="button" @click="showAddPatientForm = false" class="cancel-button">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="submit-button" :disabled="patientStore.loading">
              {{ $t('common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Patients List -->
    <div v-if="patientStore.loading" class="loading">
      {{ $t('common.loading') }}
    </div>
    
    <div v-else-if="patientStore.activePatients.length === 0" class="empty-state">
      {{ $t('patient.noPatients') }}
    </div>
    
    <div v-else class="patients-list">
      <table>
        <thead>
          <tr>
            <th>{{ $t('patient.fields.id') }}</th>
            <th>{{ $t('patient.fields.name') }}</th>
            <th>{{ $t('patient.fields.gender') }}</th>
            <th>{{ $t('patient.fields.age') }}</th>
            <th>{{ $t('patient.fields.status') }}</th>
            <th>{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="patient in patientStore.activePatients" :key="patient.patient_id">
            <td>{{ patient.patient_id }}</td>
            <td>{{ getPatientData(patient).name }}</td>
            <td>{{ getPatientData(patient).gender }}</td>
            <td>{{ getPatientData(patient).age }}</td>
            <td>
              <span :class="['status-badge', patient.active_status ? 'active' : 'inactive']">
                {{ patient.active_status ? $t('patient.status.active') : $t('patient.status.inactive') }}
              </span>
            </td>
            <td>
              <button @click="togglePatientStatus(patient)" class="action-button">
                {{ patient.active_status ? $t('patient.deactivate') : $t('patient.activate') }}
              </button>
              <button @click="startDiagnosis(patient)" class="action-button diagnosis-button">
                {{ $t('patient.startDiagnosis') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Error message display -->
    <div v-if="patientStore.error" class="error-message">
      {{ patientStore.error }}
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { usePatientStore } from '../stores/patientStore'
import { useAdminStore } from '../stores/adminStore'
import { useRouter } from 'vue-router'

export default {
  name: 'PatientPage',
  setup() {
    const patientStore = usePatientStore()
    const adminStore = useAdminStore()
    const router = useRouter()
    const showAddPatientForm = ref(false)
    
    const newPatient = ref({
      name: '病人',
      gender: 'male',
      age: 30,
      notes: '',
      admin_id: adminStore.adminId // Include admin ID with patient data
    })
    
    const resetForm = () => {
      newPatient.value = {
        name: '',
        gender: 'male',
        age: 30,
        notes: '',
        admin_id: adminStore.adminId // Keep admin ID updated
      }
    }
    
    const addPatient = async () => {
      // Make sure admin ID is current
      newPatient.value.admin_id = adminStore.adminId
      
      // Create the patient data object to match the expected C++ structure
      const patientData = {
        raw_data: JSON.stringify(newPatient.value),
        active_status: true
      }
      
      const success = await patientStore.addPatient(patientData)
      
      if (success) {
        showAddPatientForm.value = false
        resetForm()
        // No need for delayed refresh - the bridge handler now does this automatically
      }
    }
    
    const refreshPatients = async () => {
      await patientStore.fetchActivePatients()
    }
    
    const togglePatientStatus = async (patient) => {
      await patientStore.updatePatientStatus(patient.patient_id, !patient.active_status)
      await refreshPatients() // Refresh list to show updated status
    }
    
    const viewPatient = (patient) => {
      patientStore.currentPatient = patient
      // Navigate or show details, can be expanded in the future
    }
    
    const startDiagnosis = (patient) => {
      // Set the current patient in patientStore
      patientStore.currentPatient = patient
      
      // Navigate to diagnosis page - no query params needed now
      router.push({ path: '/diagnosis' })
    }
    
    const getPatientData = (patient) => {
      try {
        return JSON.parse(patient.raw_data)
      } catch (e) {
        return { name: 'Unknown', gender: 'Unknown', age: 0 }
      }
    }
    
    // Initialize the page
    onMounted(async () => {
      await refreshPatients()
    })
    
    return {
      patientStore,
      showAddPatientForm,
      newPatient,
      addPatient,
      refreshPatients,
      togglePatientStatus,
      viewPatient,
      startDiagnosis,
      getPatientData
    }
  }
}
</script>

<style scoped>
.patient-page {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.patient-controls {
  display: flex;
  gap: 0.5rem;
  margin: 1.5rem 0;
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.add-icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.patient-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.patient-form {
  background-color: white;
  border-radius: 8px;
  padding: 2rem;
  width: 90%;
  max-width: 600px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

input, select, textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus, select:focus, textarea:focus {
  border-color: #3498db;
  outline: none;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.cancel-button {
  background-color: #e0e0e0;
  color: #333;
}

.submit-button {
  background-color: #2ecc71;
  color: white;
}

.patients-list {
  margin-top: 2rem;
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

.loading, .empty-state {
  margin-top: 1rem;
  text-align: center;
  color: #666;
  padding: 2rem;
  border: 1px dashed #ccc;
  border-radius: 8px;
}

.error-message {
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
}

.diagnosis-button {
  color: #2ecc71;
  font-weight: bold;
}
</style>