<template>
  <div class="survey-page">
    <div class="survey-container">
      <div v-if="!surveyStarted" class="survey-intro">
        <div class="survey-card">
          <h2>{{ $t('survey.bdiTitle') }}</h2>
          <p class="instructions">{{ $t('survey.instructions') }}</p>
          <div class="diagnosis-display">
            <p v-if="diagnosisId" class="diagnosis-info">
              Current diagnosis ID: {{ diagnosisId }}
            </p>
            <p v-else class="error-message">
              {{ $t('survey.noDiagnosisSelected') }}
            </p>
          </div>
          <button @click="startSurvey" class="start-button" :disabled="!diagnosisId">
            Start Survey
          </button>
          <p v-if="!diagnosisId && showDiagnosisWarning" class="error-message">
            {{ $t('survey.noDiagnosisSelected') }}
          </p>
        </div>
      </div>
      <div v-else-if="!surveyCompleted" class="survey-questions">
        <div class="progress-bar">
          <div class="progress" :style="{ width: progressPercentage + '%' }"></div>
        </div>
        <div class="question-counter">
          {{ $t('survey.question') }} {{ currentQuestionIndex + 1 }} {{ $t('survey.of') }} {{ questions.length }}
        </div>
        <div class="question-card">
          <h3>{{ currentQuestion.question }}</h3>
          <div class="options">
            <div v-for="(option, index) in currentQuestion.options" :key="index" class="option"
                 :class="{ 'selected': answers[currentQuestionIndex] === index }"
                 @click="selectAnswer(index)">
              <div class="option-score">{{ index }}</div>
              <div class="option-text">{{ option }}</div>
            </div>
          </div>
          <div class="navigation-buttons">
            <button @click="previousQuestion" class="nav-button" :disabled="currentQuestionIndex === 0">
              {{ $t('survey.previous') }}
            </button>
            <button @click="nextQuestion" class="nav-button"
                    :disabled="answers[currentQuestionIndex] === undefined">
              {{ currentQuestionIndex < questions.length - 1 ? $t('survey.next') : $t('survey.submit') }}
            </button>
          </div>
        </div>
      </div>
      <div v-else class="survey-results">
        <div class="results-card">
          <h2>{{ $t('survey.resultsTitle') }}</h2>
          <div class="result-summary">
            <p class="result-score">{{ $t('survey.score') }}: <strong>{{ totalScore }}</strong></p>
            <p class="result-date">{{ $t('survey.date') }}: {{ currentDate }}</p>
            <p class="diagnosis-display">Diagnosis ID: {{ diagnosisId }}</p>
          </div>
          <div class="interpretation">
            <h3>{{ $t('survey.interpretation.title') }}</h3>
            <ul>
              <li v-for="(interp, key) in interpretations" :key="key"
                  :class="{ 'current-level': interpretationKey === key }">
                {{ $t(`survey.interpretation.${key}`) }}
              </li>
            </ul>
          </div>
          <div class="action-buttons">
            <button @click="saveSurveyResults" class="action-button save">
              {{ $t('survey.saveResults') }}
            </button>
            <button @click="restartSurvey" class="action-button restart">
              {{ $t('survey.restart') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useSurveyStore } from '../stores/surveyStore';
import { useDiagnosisStore } from '../stores/diagnosisStore';
import eventBus from '../utils/eventBus';

export default {
  name: 'SurveyView',
  setup() {
    const surveyStore = useSurveyStore();
    const diagnosisStore = useDiagnosisStore();
    const surveyStarted = ref(false);
    const surveyCompleted = ref(false);
    const currentQuestionIndex = ref(0);
    const answers = ref([]);
    const showDiagnosisWarning = ref(false);
    
    // Get diagnosis ID from store
    const diagnosisId = computed(() => diagnosisStore.currentDiagnosis?.diagnosis_id || null);
    
    onMounted(async () => {
      await surveyStore.loadBdiSurvey();
    });
    
    const questions = computed(() => surveyStore.questions);
    const currentQuestion = computed(() => questions.value[currentQuestionIndex.value] || {});
    const progressPercentage = computed(() => (currentQuestionIndex.value / questions.value.length) * 100);
    const totalScore = computed(() => answers.value.reduce((sum, answer) => sum + answer, 0));
    const currentDate = computed(() => new Date().toLocaleDateString());
    const interpretations = { minimal: '0-13', mild: '14-19', moderate: '20-28', severe: '29-63' };
    const interpretationKey = computed(() => {
      const score = totalScore.value;
      if (score <= 13) return 'minimal';
      if (score <= 19) return 'mild';
      if (score <= 28) return 'moderate';
      return 'severe';
    });
    
    function startSurvey() {
      if (!diagnosisId.value) {
        showDiagnosisWarning.value = true;
        return;
      }
      surveyStarted.value = true;
      answers.value = new Array(questions.value.length).fill(undefined);
    }
    
    function selectAnswer(optionIndex) {
      answers.value[currentQuestionIndex.value] = optionIndex;
    }
    
    function nextQuestion() {
      if (currentQuestionIndex.value < questions.value.length - 1) {
        currentQuestionIndex.value++;
      } else {
        completeSurvey();
      }
    }
    
    function previousQuestion() {
      if (currentQuestionIndex.value > 0) currentQuestionIndex.value--;
    }
    
    function completeSurvey() {
      surveyCompleted.value = true;
      surveyStore.setSurveyResults({
        diagnosisId: diagnosisId.value,
        date: currentDate.value,
        answers: [...answers.value],
        totalScore: totalScore.value,
        interpretation: interpretationKey.value
      });
    }
    
    function restartSurvey() {
      surveyStarted.value = false;
      surveyCompleted.value = false;
      currentQuestionIndex.value = 0;
      answers.value = [];
    }
    
    function saveSurveyResults() {
      const results = {
        ...surveyStore.surveyResults,
        diagnosisId: diagnosisId.value
      };
      
      console.log('Saving survey results:', results);
      eventBus.emit('log', 'Survey results saved for diagnosis ID: ' + diagnosisId.value);
      
      // API call to save to backend
      if (window.bellaBridge?.calls) {
        window.bellaBridge.calls.cppBackend('survey', {
          action: 'save',
          diagnosisId: diagnosisId.value, 
          score: totalScore.value,
          interpretation: interpretationKey.value,
          answers: [...answers.value]
        });
      }
      
      alert($t('survey.saved'));
      restartSurvey();
    }
    
    return {
      surveyStarted,
      surveyCompleted,
      currentQuestionIndex,
      questions,
      currentQuestion,
      answers,
      progressPercentage,
      showDiagnosisWarning,
      diagnosisId,
      totalScore,
      currentDate,
      interpretations,
      interpretationKey,
      startSurvey,
      selectAnswer,
      nextQuestion,
      previousQuestion,
      restartSurvey,
      saveSurveyResults
    };
  }
};
</script>

<style scoped>
.survey-page {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.survey-container {
  flex: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.survey-intro, .survey-questions, .survey-results {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.survey-card, .question-card, .results-card {
  width: 100%;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 25px;
  margin-top: 20px;
}

.instructions {
  margin: 20px 0;
  line-height: 1.6;
  color: #4a4a4a;
}

.diagnosis-display {
  margin: 20px 0;
}

.start-button {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
  width: 100%;
  font-weight: 500;
}

.start-button:disabled {
  background-color: #a0d5bf;
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  margin-top: 10px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #eaeaea;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 15px;
}

.progress {
  height: 100%;
  background-color: #42b983;
  transition: width 0.3s ease;
}

.question-counter {
  font-size: 14px;
  color: #666;
  margin-bottom: 5px;
  align-self: flex-start;
}

.options {
  margin: 25px 0;
}

.option {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option:hover {
  border-color: #42b983;
  background-color: rgba(66, 185, 131, 0.05);
}

.option.selected {
  border-color: #42b983;
  background-color: rgba(66, 185, 131, 0.1);
}

.option-score {
  min-width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-weight: bold;
  color: #555;
}

.option.selected .option-score {
  background-color: #42b983;
  color: white;
}

.option-text {
  flex: 1;
}

.navigation-buttons {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

.nav-button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background-color: #42b983;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.nav-button:disabled {
  background-color: #ddd;
  cursor: not-allowed;
}

.result-summary {
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 4px;
  margin: 20px 0;
}

.result-score {
  font-size: 18px;
  margin-bottom: 10px;
}

.interpretation {
  margin: 20px 0;
}

.interpretation ul {
  list-style-type: none;
  padding: 0;
}

.interpretation li {
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 5px;
}

.interpretation li.current-level {
  background-color: rgba(66, 185, 131, 0.1);
  border-left: 4px solid #42b983;
  font-weight: bold;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.action-button {
  flex: 1;
  padding: 12px 15px;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.action-button.save {
  background-color: #42b983;
}

.action-button.restart {
  background-color: #3498db;
}

.diagnosis-info {
  padding: 12px;
  background-color: #f0f8ff;
  border-left: 3px solid #3498db;
  font-size: 16px;
  border-radius: 4px;
}
</style>
