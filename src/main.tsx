import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import App from './App'
import { CaptureSurface } from './CaptureSurface'
import './styles.css'
import './ui.css'
import './glass.css'
import './hub.css'
import './browser/browsing.css'
import './browser/browser-shell.css'
import './motion.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><MotionConfig reducedMotion="user">{window.location.hash === '#capture' ? <CaptureSurface /> : <App />}</MotionConfig></React.StrictMode>
)
