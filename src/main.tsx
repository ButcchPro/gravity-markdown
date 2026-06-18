import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@gravity-ui/uikit/styles/styles.css'
import '@gravity-ui/markdown-editor/styles/styles.css'
import './styles.scss'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
