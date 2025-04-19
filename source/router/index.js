import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/home.vue'
import logger from '../utils/logger'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: {
      titleKey: 'routes.home'
    }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/about.vue'),
    meta: {
      titleKey: 'routes.about'
    }
  },
  {
    path: '/eeg',
    name: 'EEG',
    component: () => import('../views/eeg.vue'),
    meta: {
      titleKey: 'routes.eeg'
    }
  },
  {
    path: '/music',
    name: 'Music',
    component: () => import('../views/music.vue'),
    meta: {
      titleKey: 'routes.audio'
    }
  },
  {
    path: '/imu',
    name: 'IMU',
    component: () => import('../views/imu.vue'),
    meta: {
      titleKey: 'routes.imu'
    }
  },
  {
    path: '/heart',
    name: 'Heart',
    component: () => import('../views/heart.vue'),
    meta: {
      titleKey: 'routes.heart'
    }
  },
  {
    path: '/bluetooth',
    name: 'Bluetooth',
    component: () => import('../views/bluetooth.vue'),
    meta: {
      titleKey: 'routes.bluetooth'
    }
  },
  {
    path: '/usb',
    name: 'USB',
    component: () => import('../views/usb.vue'),
    meta: {
      titleKey: 'routes.usb'
    }
  },
  {
    path: '/account',
    name: 'Account',
    component: () => import('../views/account.vue'),
    meta: {
      titleKey: 'routes.account'
    }
  },
  {
    path: '/patient',
    name: 'Patient',
    component: () => import('../views/patient.vue'),
    meta: {
      titleKey: 'routes.patient'
    }
  },
  {
    path: '/diagnosis',
    name: 'Diagnosis',
    component: () => import('../views/diagnosis.vue'),
    meta: {
      titleKey: 'routes.diagnosis'
    }
  },
  {
    path: '/survey',
    name: 'Survey',
    component: () => import('../views/survey.vue'),
    meta: {
      titleKey: 'routes.survey'
    }
  },
  {
    path: '/predict',
    name: 'Report',
    component: () => import('../views/predict.vue'),
    meta: {
      titleKey: 'routes.report'
    }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// Add navigation guards to debug routing issues
router.beforeEach((to, from, next) => {
  logger.info(`Navigating from ${from.path} to ${to.path}`)
  
  next()
})

// Add error handler for route loading failures
router.onError((error) => {
  logger.error({
    title: 'Router Error',
    message: error.message
  })
  
  if (error.message.includes('Failed to fetch dynamically imported module')) {
    logger.error('Dynamic import failed. Check if file exists: ' + error.message)
  }
})

export default router
