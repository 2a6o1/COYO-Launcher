import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import { I18nProvider } from './context/I18nContext.jsx'

function Root() {
  const [showApp, setShowApp] = useState(false);
  return showApp ? <App /> : <LoadingScreen onFinish={() => setShowApp(true)} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </StrictMode>,
)
