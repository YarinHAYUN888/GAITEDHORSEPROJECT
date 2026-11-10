// Web Push Notifications wrapper
const FARRIER_INTERVAL_MS = 6 * 7 * 24 * 60 * 60 * 1000; // 6 weeks

export function isPushSupported(): boolean {
  return "Notification" in window && "serviceWorker" in navigator;
}

export async function requestPushPermission(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function getPushPermissionState(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export function scheduleFarrierReminder(horseName: string) {
  const key = `farrier_reminder_${horseName}`;
  const nextReminder = Date.now() + FARRIER_INTERVAL_MS;
  localStorage.setItem(key, String(nextReminder));
}

export function checkDueReminders(): Array<{ horseName: string; dueDate: number }> {
  const due: Array<{ horseName: string; dueDate: number }> = [];
  const now = Date.now();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("farrier_reminder_")) {
      const dueDate = Number(localStorage.getItem(key));
      if (dueDate <= now) {
        due.push({ horseName: key.replace("farrier_reminder_", ""), dueDate });
      }
    }
  }
  return due;
}

export function showLocalNotification(title: string, body: string) {
  if (Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  });
}
