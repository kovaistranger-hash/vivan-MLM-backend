import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './pages/App';
import ScrollToTop from './components/ScrollToTop';
import { ReduceMotionSafe } from './components/motion/ReduceMotionSafe';
import './index.css';
import { useAuthStore } from './stores/authStore';

useAuthStore.getState().hydrate();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ReduceMotionSafe>
        <ScrollToTop />
        <App />
        <Toaster richColors position="top-center" closeButton />
      </ReduceMotionSafe>
    </BrowserRouter>
  </React.StrictMode>
);
