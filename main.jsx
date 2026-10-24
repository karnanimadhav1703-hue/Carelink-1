import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ModeProvider } from './context/ModeContext';
import { SpeechProvider } from './context/SpeechContext';
import App from './App';
import { MedicineProvider } from './context/MedicineContext';
import { EmergencyProvider } from './context/EmergencyContext';
import { AppointmentProvider } from './context/AppointmentContext';
import { LanguageProvider } from './context/LanguageContext';
import './styles.css';

// Register in production only; notification permission is still a separate user action.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/notifications-sw.js', { updateViaCache: 'none' }).catch(() => {
    console.warn('CareLink offline support is unavailable. Online features can still be used.');
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider><LanguageProvider><ModeProvider><SpeechProvider><MedicineProvider><EmergencyProvider><AppointmentProvider><App /></AppointmentProvider></EmergencyProvider></MedicineProvider></SpeechProvider></ModeProvider></LanguageProvider></AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
