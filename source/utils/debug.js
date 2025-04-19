console.log('Debug script loaded');
// Fix the Vue reference issue
try {
  const vueVersion = window.Vue ? window.Vue.version : 'Vue not globally available';
  console.log('Vue version (global):', vueVersion);
} catch (e) {
  console.log('Vue not loaded as global variable');
}
console.log('Current environment:', process.env.NODE_ENV);

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
  console.log('App container exists:', Boolean(document.getElementById('app')));
});

window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error caught:', message);
  console.error('Error details:', error);
  return false;
};
