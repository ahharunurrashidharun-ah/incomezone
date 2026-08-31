import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Remove any legacy fallback mock/demo data from localStorage so only real posts are visible
try {
  const cachedJobs = localStorage.getItem('iz_fallback_jobs');
  if (cachedJobs && cachedJobs.includes('job-1')) {
    localStorage.removeItem('iz_fallback_jobs');
  }
  const cachedAds = localStorage.getItem('iz_fallback_ads');
  if (cachedAds && cachedAds.includes('ad-1')) {
    localStorage.removeItem('iz_fallback_ads');
  }
} catch (e) {
  console.warn('Storage cleanup warning:', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
