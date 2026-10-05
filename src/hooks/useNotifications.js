import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function useNotifications(user) {
  const [permission, setPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if already subscribed on mount
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return;
    const check = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        // ignore
      }
    };
    check();
  }, [user]);

  const subscribe = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') { setLoading(false); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = sub.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      }, { onConflict: 'endpoint' });

      if (!error) setSubscribed(true);
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
        setSubscribed(false);
      }
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
    }
    setLoading(false);
  };

  const toggle = () => (subscribed ? unsubscribe() : subscribe());

  const supported = Boolean(VAPID_PUBLIC_KEY)
    && typeof Notification !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window;

  return { permission, subscribed, loading, toggle, supported };
}
