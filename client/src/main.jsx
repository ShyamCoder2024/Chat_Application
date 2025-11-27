import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'


import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { SocketProvider } from './context/SocketContext.jsx'
import { SoundProvider } from './context/SoundContext.jsx'
import './index.css'
import './MobileOverrides.css'

import ErrorBoundary from './components/atoms/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
