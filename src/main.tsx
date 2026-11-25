import React from 'react';
import ReactDOM from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './app/styles.css';
import { LocaleProvider, useLocale } from './app/locale';

const root = ReactDOM.createRoot(document.getElementById('root')!);
const render = (content: React.ReactNode) => root.render(
  <React.StrictMode>
    <LocaleProvider>{content}</LocaleProvider>
  </React.StrictMode>,
);

function StartupNotice({failed = false}: {failed?: boolean}) {
  const {text} = useLocale();
  return <main className="atlas-startup" role={failed ? 'alert' : 'status'}>
    <h1>CryptoFrontierAtlas</h1>
    <p>{failed ? text.loadFailed : text.loadingAtlas}</p>
    {failed && <button type="button" onClick={() => window.location.reload()}>{text.reloadAtlas}</button>}
  </main>;
}

// The application imports the checked analysis asset. Keep a visible, recoverable
// state if that request or a deployment chunk is unavailable; never show empty data.
render(<StartupNotice />);
void import('./app/App').then(({default: App}) => render(<App />))
  .catch(() => render(<StartupNotice failed />));
