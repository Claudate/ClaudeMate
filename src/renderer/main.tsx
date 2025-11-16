/**
 * React Renderer Process Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Type declarations for window.electronAPI
declare global {
  interface Window {
    electronAPI: import('../main/preload/index').ElectronAPI;
    platform: import('../main/preload/index').PlatformAPI;
  }
}

// Memory leak prevention: Cleanup on unmount
window.addEventListener('beforeunload', () => {
  // Cleanup any subscriptions, timers, etc.
  console.info('Renderer process cleanup');
});

// Render app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
