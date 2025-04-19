import { reactive } from 'vue';
import eventBus from '../utils/eventBus';

const state = reactive({
  questions: [],
  surveyResults: null,
  surveyHistory: [],
  isLoading: false,
  error: null
});

export const useSurveyStore = () => {
  const loadBdiSurvey = async () => {
    try {
      state.isLoading = true;
      const fileUrl = new URL('../assets/data/bdi.json', import.meta.url);
      let data;
      if (fileUrl.protocol === 'file:') {
        // Fallback: statically import JSON when served via file://
        data = (await import('../assets/data/bdi.json')).default;
      } else {
        const response = await fetch(fileUrl.href);
        if (!response.ok) {
          throw new Error('Failed to fetch survey questions');
        }
        data = await response.json();
      }
      state.questions = data.questions;
      eventBus.emit('log', 'BDI-II survey questions loaded');
      state.error = null;
    } catch (error) {
      console.error('Error loading survey:', error);
      state.error = error.message;
      eventBus.emit('log', 'Error loading BDI-II survey questions: ' + error.message);
      state.questions = []; // Set to empty array instead of calling getBdiQuestionsStatic
    } finally {
      state.isLoading = false;
    }
  };

  const setSurveyResults = (results) => {
    state.surveyResults = results;
    state.surveyHistory.push({
      ...results,
      id: generateId(),
      timestamp: new Date().toISOString()
    });
    eventBus.emit('log', `BDI-II survey completed with score: ${results.totalScore}`);
  };

  const clearSurveyResults = () => {
    state.surveyResults = null;
  };

  const getInterpretation = (score) => {
    if (score <= 13) return 'minimal';
    if (score <= 19) return 'mild';
    if (score <= 28) return 'moderate';
    return 'severe';
  };

  return {
    get questions() { return state.questions; },
    get surveyResults() { return state.surveyResults; },
    get surveyHistory() { return state.surveyHistory; },
    get isLoading() { return state.isLoading; },
    get error() { return state.error; },
    loadBdiSurvey,
    setSurveyResults,
    clearSurveyResults,
    getInterpretation
  };
};

function generateId() {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}