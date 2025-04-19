// filepath: /Users/zou/Development/Valen-GTK4/interface/source/stores/adminStore.js
import { defineStore } from 'pinia'
import logger from '../utils/logger.js'

export const useAdminStore = defineStore('admin', {
  state: () => ({
    loading: false,
    error: null,
    currentAdmin: null,
    isAuthenticated: false,
    // Hardcoded admin info for development purposes
    defaultAdmin: {
      admin_id: 1,
      username: 'admin',
      full_name: 'Administrator',
      role: 'admin'
    }
  }),
  
  getters: {
    isLoading: (state) => state.loading,
    isLoggedIn: (state) => state.isAuthenticated,
    adminId: (state) => state.currentAdmin?.admin_id || state.defaultAdmin.admin_id,
    adminName: (state) => state.currentAdmin?.full_name || state.defaultAdmin.full_name
  },
  
  actions: {
    async login(username, password) {
      try {
        this.loading = true;
        this.error = null;
        
        // Call the C++ backend through bellaBridge
        if (window.bellaBridge) {
          logger.info('Sending login request to C++ backend');
          
          const success = window.bellaBridge.calls.cppBackend('auth', {
            operation: 'login',
            data: { username, password }
          });
          
          if (success) {
            logger.info('Login request sent successfully');
            // The actual authentication result will be returned through callbacks
            // For now, we'll use the default admin as a fallback
            this.currentAdmin = this.defaultAdmin;
            this.isAuthenticated = true;
            return true;
          } else {
            throw new Error('Failed to send login request to backend');
          }
        } else {
          // Fall back to mock implementation for development
          logger.info('Using mock implementation for login');
          
          // Simple mock auth - in a real app, this would verify against backend
          if (username === 'admin' && password === 'admin') {
            this.currentAdmin = this.defaultAdmin;
            this.isAuthenticated = true;
            logger.info('Mock login successful');
            return true;
          } else {
            throw new Error('Invalid username or password');
          }
        }
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Login Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    async logout() {
      try {
        this.loading = true;
        this.error = null;
        
        // Call the backend for logout if needed
        if (window.bellaBridge) {
          logger.info('Sending logout request to C++ backend');
          
          window.bellaBridge.calls.cppBackend('auth', {
            operation: 'logout'
          });
        }
        
        // Clear local state regardless of backend response
        this.currentAdmin = null;
        this.isAuthenticated = false;
        logger.info('Logout successful');
        
        return true;
      } catch (error) {
        this.error = error.message;
        logger.error({
          title: 'Logout Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    // Used by C++ backend to return authentication results
    updateAuthStatus(authResult) {
      if (authResult.success) {
        this.currentAdmin = {
          admin_id: authResult.admin_id,
          username: authResult.username,
          full_name: authResult.full_name,
          role: authResult.role
        };
        this.isAuthenticated = true;
        logger.info(`Authentication successful for user: ${authResult.username}`);
      } else {
        this.currentAdmin = null;
        this.isAuthenticated = false;
        this.error = authResult.error || 'Authentication failed';
        logger.error({
          title: 'Authentication Error',
          message: this.error
        });
      }
    },
    
    // Check if current session is valid
    async checkSession() {
      try {
        this.loading = true;
        
        if (window.bellaBridge) {
          const success = window.bellaBridge.calls.cppBackend('auth', {
            operation: 'check_session'
          });
          
          if (!success) {
            // If session check fails, reset authentication state
            this.currentAdmin = null;
            this.isAuthenticated = false;
          }
          // Actual session status will be returned via updateAuthStatus
        } else {
          // For development, we'll assume the session is valid if we have an admin
          logger.info('Using mock session check');
          // No change to current state
        }
        
        return this.isAuthenticated;
      } catch (error) {
        logger.error({
          title: 'Session Check Error',
          message: error.message
        });
        return false;
      } finally {
        this.loading = false;
      }
    }
  }
})