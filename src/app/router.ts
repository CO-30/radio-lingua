// ハッシュ式の画面遷移（GitHub Pages で再読み込みしても404にならない）
import { useSyncExternalStore } from 'react';

function current() {
  return location.hash.replace(/^#/, '') || '/map';
}
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
export function useRoute() {
  const path = useSyncExternalStore(subscribe, current);
  const [, name = 'map', arg = ''] = path.split('/');
  return { path, name, arg: decodeURIComponent(arg) };
}
export function navigate(path: string) {
  if (current() !== path) location.hash = path;
}
