import { defineStore } from 'pinia';
import axios from 'axios';
import logger from '../utils/logger';
import { useDiagnosisStore } from './diagnosisStore';

export const useEegDetailStore = defineStore('eegDetail', {
  state: () => ({
    currentDiagnosis: null,
    eegRecords: [],
    error: null,
    loading: false,
  }),

  actions: {
    async fetchEegRecordsForDiagnosis() {
      try {
        this.loading = true;
        this.error = null;

        const diagnosisStore = useDiagnosisStore();
        const diagnosisId = diagnosisStore.currentDiagnosis?.diagnosis_id;
        const diagnosisStage = diagnosisStore.currentDiagnosisStage;

        if (!diagnosisId) {
          throw new Error('No diagnosis ID available for fetching EEG records');
        }

        if (window.bellaBridge?.isMockMode) {
          logger.info('Using mock implementation for fetchEegRecordsForDiagnosis');
          this.eegRecords = []; // Replace with mock data if available
          return true;
        }

        logger.info(`Fetching EEG records for diagnosis ID: ${diagnosisId}, stage: ${diagnosisStage}`);

        const success = await window.bellaBridge.calls.cppBackend('record', {
          table: 'eeg',
          operation: 'read',
          data: {
            diagnosis_id: diagnosisId,
            diagnosis_stage: '3'
          },
        });

        if (success && success.records) {
          this.eegRecords = success.records;
          logger.info(`Fetched ${this.eegRecords.length} EEG records for diagnosis ID: ${diagnosisId}, stage: ${diagnosisStage}`);
          return true;
        } else {
          throw new Error('Failed to fetch EEG records or no records found');
        }
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Fetch EEG Records Error',
          message: error.message,
        });
        return false;
      } finally {
        this.loading = false;
      }
    },

    setCurrentDiagnosis(diagnosis) {
      if (!diagnosis || !diagnosis.diagnosis_id) {
        logger.warn('Attempted to set invalid diagnosis');
        return false;
      }

      this.currentDiagnosis = diagnosis;
      logger.info(`Set current diagnosis ID: ${diagnosis.diagnosis_id}`);
      return true;
    },

    clearEegRecords() {
      this.eegRecords = [];
      logger.info('Cleared EEG records');
    },
  },

  getters: {
    hasError: (state) => !!state.error,
    isLoading: (state) => state.loading,
  },
});