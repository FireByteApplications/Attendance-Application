import { useEffect, useRef, useState } from 'react';

export default function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const registrationRef = useRef(null);
  const reloadAfterUpdate = useRef(false);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);

    if (!('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('online', markOnline);
        window.removeEventListener('offline', markOffline);
      };
    }

    const serviceWorker = navigator.serviceWorker;
    let disposed = false;
    let installing = null;
    let updateTimer;
    const onControllerChange = () => {
      if (reloadAfterUpdate.current) window.location.reload();
    };
    const onStateChange = () => {
      if (installing?.state === 'installed' && serviceWorker.controller) {
        setUpdateReady(true);
      }
    };
    const onUpdateFound = () => {
      installing?.removeEventListener('statechange', onStateChange);
      installing = registrationRef.current?.installing;
      installing?.addEventListener('statechange', onStateChange);
    };
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        registrationRef.current?.update().catch(() => {});
      }
    };

    serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', checkForUpdate);
    serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        if (disposed) return;
        registrationRef.current = registration;
        if (registration.waiting && serviceWorker.controller) setUpdateReady(true);
        registration.addEventListener('updatefound', onUpdateFound);
        onUpdateFound();
        updateTimer = window.setInterval(checkForUpdate, 60 * 60 * 1000);
      })
      .catch((error) => console.warn('Offline support unavailable:', error));

    return () => {
      disposed = true;
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
      document.removeEventListener('visibilitychange', checkForUpdate);
      serviceWorker.removeEventListener('controllerchange', onControllerChange);
      registrationRef.current?.removeEventListener('updatefound', onUpdateFound);
      installing?.removeEventListener('statechange', onStateChange);
      window.clearInterval(updateTimer);
      registrationRef.current = null;
    };
  }, []);

  const reloadForUpdate = () => {
    const waiting = registrationRef.current?.waiting;
    if (!waiting) return;
    reloadAfterUpdate.current = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <>
      {!online && (
        <div className="alert alert-warning pwa-status" role="status">
          You're offline. Attendance submissions and admin actions need a connection.
        </div>
      )}
      {updateReady && (
        <div className="alert alert-info pwa-status d-flex flex-wrap align-items-center justify-content-between gap-2" role="status">
          <span>A new version is ready. Finish any unsent work before reloading.</span>
          <button type="button" className="btn btn-primary" onClick={reloadForUpdate}>Reload now</button>
        </div>
      )}
    </>
  );
}
