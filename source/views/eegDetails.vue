<template>
  <div class="eeg-details-page">
    <h1>{{ $t('eeg.detailsTitle') || 'EEG Details' }}</h1>

    <div v-if="loading" class="loading">
      {{ $t('common.loading') || 'Loading...' }}
    </div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else class="details-content">
      <h2>{{ $t('eeg.diagnosisId') || 'Diagnosis ID' }}: {{ diagnosis.diagnosis_id }}</h2>
      <p>{{ $t('eeg.date') || 'Date' }}: {{ formatDate(diagnosis.created_at) }}</p>
      <p>{{ $t('eeg.status') || 'Status' }}: {{ diagnosis.active_status ? $t('patient.status.active') : $t('patient.status.inactive') }}</p>

      <div class="eeg-data">
        <h3>{{ $t('eeg.dataTitle') || 'EEG Data' }}</h3>
        <pre>{{ diagnosis.eeg_data || $t('eeg.noData') || 'No EEG data available' }}</pre>
      </div>

      <button @click="goBack" class="primary-button">
        {{ $t('common.back') || 'Back' }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useDiagnosisStore } from '../stores/diagnosisStore';
import { useRouter, useRoute } from 'vue-router';

export default {
  name: 'EegDetailsPage',
  setup() {
    const diagnosisStore = useDiagnosisStore();
    const router = useRouter();
    const route = useRoute();

    const diagnosis = ref(null);
    const loading = ref(true);
    const error = ref(null);

    onMounted(async () => {
      try {
        const diagnosisId = route.query.diagnosis_id;
        if (!diagnosisId) {
          throw new Error('Diagnosis ID is missing');
        }

        await diagnosisStore.fetchDiagnosisById(diagnosisId);
        diagnosis.value = diagnosisStore.currentDiagnosis;
      } catch (err) {
        error.value = err.message;
      } finally {
        loading.value = false;
      }
    });

    const formatDate = (dateString) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleString();
      } catch (e) {
        return dateString;
      }
    };

    const goBack = () => {
      router.push({ path: '/diagnosis' });
    };

    return {
      diagnosis,
      loading,
      error,
      formatDate,
      goBack,
    };
  },
};
</script>

<style scoped>
.eeg-details-page {
  padding: 2rem;
}

.loading {
  text-align: center;
  color: #666;
}

.error-message {
  color: #721c24;
  background-color: #f8d7da;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.details-content {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.eeg-data {
  margin-top: 1rem;
  background: #fff;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.primary-button {
  background-color: #3498db;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.primary-button:hover {
  background-color: #2980b9;
}
</style>