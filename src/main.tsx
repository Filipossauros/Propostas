import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from "./App.tsx"
import { copiarDaVersaoAnterior } from "./core/persistencia"

copiarDaVersaoAnterior()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
