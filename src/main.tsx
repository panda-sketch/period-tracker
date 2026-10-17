import { render } from 'preact';
import { App } from './ui/App';
import './styles.css';

render(<App />, document.getElementById('app')!);

// The service worker only caches the app's own files so it works offline.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
