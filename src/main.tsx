import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted fonts (fontsource): no CDN, font-display: swap by default.
import '@fontsource-variable/geist'

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
