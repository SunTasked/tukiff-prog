import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import './lib/install'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthProvider.tsx'
import { BusyOverlay } from './components/ui'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <BusyOverlay />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
