<template>
  <div class="home">
    <languageSelector />
    <h1>{{ $t('common.welcome') }}</h1>
    
    <div class="navigation-links">
      <router-link to="/patient" class="nav-link">
        <img src="../assets/icons/patient.png" alt="Patient" class="nav-icon">
        <span>{{ $t('routes.patient') }}</span>
      </router-link>
      
      <router-link to="/diagnosis" class="nav-link">
        <img src="../assets/icons/diagnosis.png" alt="Diagnosis" class="nav-icon">
        <span>{{ $t('routes.diagnosis') }}</span>
      </router-link>
      
      <router-link to="/survey" class="nav-link">
        <img src="../assets/icons/survey.png" alt="Survey" class="nav-icon">
        <span>{{ $t('routes.survey') }}</span>
      </router-link>
      
      <router-link to="/predict" class="nav-link">
        <img src="../assets/icons/predict.png" alt="Report" class="nav-icon">
        <span>{{ $t('routes.report') }}</span>
      </router-link>
      
      <router-link to="/eeg" class="nav-link">
        <img src="../assets/icons/eeg.png" alt="EEG" class="nav-icon">
        <span>{{ $t('routes.eeg') }}</span>
      </router-link>
      
      <router-link to="/imu" class="nav-link">
        <img src="../assets/icons/imu.png" alt="IMU" class="nav-icon">
        <span>{{ $t('routes.imu') }}</span>
      </router-link>

      <router-link to="/heart" class="nav-link">
        <img src="../assets/icons/heart.png" alt="Heart" class="nav-icon">
        <span>{{ $t('routes.heart') }}</span>
      </router-link>
      
      <router-link to="/bluetooth" class="nav-link">
        <img src="../assets/icons/bluetooth.png" alt="Bluetooth" class="nav-icon">
        <span>{{ $t('routes.bluetooth') }}</span>
      </router-link>
      
      <router-link to="/usb" class="nav-link">
        <img src="../assets/icons/usb.png" alt="USB" class="nav-icon">
        <span>{{ $t('routes.usb') }}</span>
      </router-link>
      
      <router-link to="/audio" class="nav-link">
        <img src="../assets/icons/audio.png" alt="Audio" class="nav-icon">
        <span>{{ $t('routes.audio') }}</span>
      </router-link>
      
      <router-link to="/about" class="nav-link">
        <img src="../assets/icons/about.png" alt="About" class="nav-icon">
        <span>{{ $t('routes.about') }}</span>
      </router-link>
    </div>
  </div>
</template>

<script>
import languageSelector from '../components/languageSelector.vue';

export default {
  name: 'Home',
  
  components: {
    languageSelector
  },
  
  setup() {
    return {};
  }
}
</script>

<style scoped>
.home {
  padding: 20px;
  max-width: 1200px; /* Increased from 1000px for better use of space */
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  min-height: 80vh;
}

h1 {
  margin-bottom: 20px; /* Reduced from 30px to use space more efficiently */
  color: #2c3e50;
  text-align: center;
}

.navigation-links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); /* Responsive grid that adapts to screen size */
  gap: 15px; /* Slightly reduced from 20px */
  margin-top: 30px; /* Increased from 20px */
  margin-bottom: 50px; /* Reduced from 70px to accommodate smaller bottom bar */
  justify-content: center;
}

.nav-link {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 20px 15px; /* Increased padding-top and padding-bottom from 15px to 20px */
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: #2c3e50;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid #eaeaea;
  min-height: 145px; /* Increased from 130px */
  justify-content: center;
  aspect-ratio: 1 / 1; /* Square aspect ratio for consistent look */
}

.nav-link:hover {
  transform: translateY(-3px); /* Reduced from -5px */
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
  border-color: #42b983;
}

.nav-icon {
  width: 40px; /* Reduced from 48px */
  height: 40px;
  margin-bottom: 8px; /* Reduced from 10px */
}

.nav-link span {
  font-size: 14px; /* Reduced from 16px */
  font-weight: 500;
  text-align: center;
}

.log-button {
  cursor: pointer;
  background-color: #f8f9fa;
  font-family: inherit;
  border: 1px solid #eaeaea;
}

.log-button:hover {
  background-color: rgba(66, 185, 131, 0.1);
}

/* Optimized responsive breakpoints */
@media (min-width: 1200px) {
  .navigation-links {
    grid-template-columns: repeat(4, 1fr); /* 4 columns on large screens */
  }
}

@media (max-width: 900px) and (min-width: 601px) {
  .navigation-links {
    grid-template-columns: repeat(3, 1fr); /* 3 columns on medium screens */
  }
}

@media (max-width: 600px) {
  .navigation-links {
    grid-template-columns: repeat(2, 1fr); /* 2 columns on small screens */
  }
  
  .nav-link {
    min-height: 125px; /* Increased from 110px */
  }
  
  .nav-icon {
    width: 36px;
    height: 36px;
  }
}

@media (max-width: 400px) {
  .navigation-links {
    grid-template-columns: 1fr; /* 1 column on very small screens */
  }
}
</style>