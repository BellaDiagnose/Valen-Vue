/**
 * Simple event bus for application-wide event communication
 * This replaces the previous approach of using this.$root for events
 */

import { reactive } from 'vue';

class EventBus {
  constructor() {
    this.events = reactive({});
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {any} payload - Event payload
   */
  emit(event, payload) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        callback(payload);
      });
    }
  }
}

// Export the event bus instance and make it globally available
const eventBus = new EventBus();
window.eventBus = eventBus;
export default eventBus;