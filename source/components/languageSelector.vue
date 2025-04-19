<template>
  <div class="language-selector">
    <select v-model="currentLanguage" @change="changeLanguage">
      <option value="en">{{ $t('languages.en') }}</option>
      <option value="zh">{{ $t('languages.zh') }}</option>
      <option value="fr">{{ $t('languages.fr') }}</option>
    </select>
  </div>
</template>

<script>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import logger from '../utils/logger';

export default {
  name: 'languageSelector',
  
  setup() {
    const { locale } = useI18n({ useScope: 'global' });
    
    // Create a reactive reference for the current language
    const currentLanguage = ref(locale.value);
    
    // Function to change language
    const changeLanguage = () => {
      locale.value = currentLanguage.value;
      // Store the selected language in localStorage
      localStorage.setItem('language', currentLanguage.value);
      logger.info(`Language changed to: ${currentLanguage.value}`);
      
      // Emit event that language has changed
      window.dispatchEvent(new CustomEvent('language-changed', { 
        detail: { language: currentLanguage.value } 
      }));
    };
    
    return { 
      currentLanguage, 
      changeLanguage 
    };
  }
}
</script>

<style scoped>
.language-selector {
  margin: 10px 0;
  text-align: right;
}

.language-selector select {
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  background-color: white;
  cursor: pointer;
  font-size: 0.9rem;
}

.language-selector select:hover {
  border-color: #aaa;
}

.language-selector select:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.2);
}
</style>