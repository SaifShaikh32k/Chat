// firebase-messaging-sw.js
// ⚠️  This file MUST stay at the root of your GitHub Pages repo.
// ⚠️  Replace the firebaseConfig object below with YOUR project values
//     (same values you put in js/config.js).

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// ── Paste YOUR Firebase config here ──────────────────────
firebase.initializeApp({
  apiKey:            "AIzaSyDtypgH4ugzhOCi70JonjvuVxFGg3hPGeI",
  authDomain:        "chatting2-13dfb.firebaseapp.com",
  projectId:         "chatting2-13dfb",
  storageBucket:     "chatting2-13dfb.firebasestorage.app",
  messagingSenderId: "385769991125",
  appId:             "1:385769991125:web:316e6dd01854ec15fa2b5c"
});

const messaging = firebase.messaging();

// Handles push when browser tab is closed / in background
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'New message';
  const body  = payload.notification?.body  || '';

  self.registration.showNotification(title, {
    body:    body,
    icon:    '/icon-192.png',   // optional: add an icon.png to your repo
    badge:   '/icon-192.png',
    vibrate: [200, 100, 200],
    data:    payload.data || {}
  });
});

// Tap notification → open / focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
