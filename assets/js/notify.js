// Pedyo — notification preference and browser display
const KEY = 'pedyo_notifications';

export function notificationsAllowed() {
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted' && localStorage.getItem(KEY) !== 'off';
}

export function setNotifications(enabled) {
  localStorage.setItem(KEY, enabled ? 'on' : 'off');
}

// Resolves to the resulting permission: granted | denied | unsupported
export async function enableNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  const perm = await Notification.requestPermission();
  setNotifications(perm === 'granted');
  return perm;
}

export function showNotification(title, body, href) {
  if (!notificationsAllowed()) return;
  try {
    const n = new Notification(title, { body: body || '', icon: '/assets/images/logo/pedyo-mark.svg' });
    n.onclick = () => {
      window.focus();
      if (href) window.location.href = href;
      n.close();
    };
  } catch (e) {
    console.error('Notification error:', e);
  }
}
