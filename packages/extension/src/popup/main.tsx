import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found')
createRoot(rootEl).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
