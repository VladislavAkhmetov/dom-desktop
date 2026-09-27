import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import App from './App'
import { CaptureSurface } from './CaptureSurface'
import './styles.css'
import './ui.css'
import './glass.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{window.location.hash === '#capture' ? <CaptureSurface /> : <App />}</React.StrictMode>
)
