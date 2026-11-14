import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/services';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ホーム画面に追加したときも素早く開けるよう、本番では Service Worker を登録する
if (import.meta.env.PROD && 'serviceWorker' in navigator && !new URLSearchParams(location.search).has('engine')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* 登録できなくてもアプリは動く */
    });
  });
}
