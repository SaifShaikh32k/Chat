# TeamChat — Complete Setup Guide

Follow these 5 steps and your chat app will be live on GitHub Pages.
Total time: **~25 minutes**.

---

## Step 1 — Prepare Your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new sheet.
2. Rename the first sheet tab to exactly: **`Users`**
3. Add these headers in **Row 1** exactly as shown:

   | A        | B        | C           |
   |----------|----------|-------------|
   | UserID   | Password | DisplayName |

4. Add one row per team member from **Row 2** onwards:

   | A       | B        | C         |
   |---------|----------|-----------|
   | alice   | pass123  | Alice     |
   | bob     | bobpass  | Bob Patel |
   | charlie | chpass   | Charlie   |

   > ⚠️ UserID and Password are **case-sensitive**.

5. Copy the Sheet's URL. The Sheet ID is the long string between `/d/` and `/edit`:
   ```
   https://docs.google.com/spreadsheets/d/  ←SHEET_ID→  /edit
   ```

---

## Step 2 — Create the Google Apps Script Backend

This acts as your server — it validates logins and sends push notifications.

1. Go to [script.google.com](https://script.google.com) → **New project**
2. Delete the default code and paste **everything** below:

```javascript
// ── CONFIG ───────────────────────────────────────────────
const SHEET_ID   = 'YOUR_GOOGLE_SHEET_ID';       // from Step 1
const PROJECT_ID = 'chatting2-13dfb';            // your Firebase project ID

// Service account credentials — paste from the JSON file you download in Step 2b
const SA_EMAIL = 'firebase-adminsdk-fbsvc@chatting2-13dfb.iam.gserviceaccount.com';
const SA_KEY   = '-----BEGIN PRIVATE KEY-----\nPASTE_YOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n';
// ─────────────────────────────────────────────────────────

function doPost(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try {
    const req = JSON.parse(e.postData.contents);
    let res;
    switch (req.action) {
      case 'login':    res = handleLogin(req.userId, req.password);                    break;
      case 'getUsers': res = handleGetUsers(req.userId);                               break;
      case 'notify':   res = handleNotify(req.token, req.title, req.body, req.data);   break;
      default:         res = { success: false, message: 'Unknown action' };
    }
    out.setContent(JSON.stringify(res));
  } catch (err) {
    out.setContent(JSON.stringify({ success: false, message: err.toString() }));
  }
  return out;
}

function handleLogin(userId, password) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Users');
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const [id, pass, name] = rows[i];
    if (String(id).trim() === String(userId).trim() &&
        String(pass).trim() === String(password).trim()) {
      return { success: true, user: { userId: String(id).trim(), displayName: String(name).trim() } };
    }
  }
  return { success: false, message: 'Invalid ID or password.' };
}

function handleGetUsers(excludeId) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Users');
  const rows  = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < rows.length; i++) {
    const [id, , name] = rows[i];
    const uid = String(id).trim();
    if (uid && uid !== excludeId) users.push({ userId: uid, displayName: String(name).trim() });
  }
  return { success: true, users };
}

// ── FCM v1 notification (uses service account JWT) ────────
function handleNotify(token, title, body, data) {
  try {
    const accessToken = getFCMAccessToken();
    const message = {
      message: {
        token: token,
        notification: { title: title, body: body },
        data: data || {}
      }
    };
    UrlFetchApp.fetch(
      `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type':  'application/json'
        },
        payload: JSON.stringify(message),
        muteHttpExceptions: true
      }
    );
    return { success: true };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function getFCMAccessToken() {
  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss:   SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600
  };
  const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claim));
  const toSign  = header + '.' + payload;
  const sig     = base64url(Utilities.computeRsaSha256Signature(toSign, SA_KEY));
  const jwt     = toSign + '.' + sig;

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }
  });
  return JSON.parse(resp.getContentText()).access_token;
}

function base64url(data) {
  const encoded = (typeof data === 'string')
    ? Utilities.base64EncodeWebSafe(data)
    : Utilities.base64EncodeWebSafe(data);
  return encoded.replace(/=+$/, '');
}
```

### Step 2b — Get your Service Account key

This is needed because Firebase now requires OAuth2 (the old Server Key no longer works).

1. In Firebase Console → **Project Settings → Service accounts** tab
2. Click **Generate new private key** → **Generate key**
3. A `.json` file downloads — open it and copy:
   - `client_email` → paste as `SA_EMAIL` in the script above
   - `private_key` → paste as `SA_KEY` (it's the long string starting with `-----BEGIN PRIVATE KEY-----`)

> ⚠️ Keep this JSON file private — never share it or commit it to GitHub.

4. Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy** → Copy the Web App URL (it looks like `https://script.google.com/macros/s/ABC.../exec`)

> 📌 Save this URL — you'll need it in Step 5.

---

## Step 3 — Create Your Firebase Project

Firebase gives you real-time messaging and push notifications (free tier).

### 3a — Create project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it a name → **Continue** (disable Google Analytics is fine)

### 3b — Enable Realtime Database
1. In the sidebar → **Build → Realtime Database → Create database**
2. Choose **Start in test mode** (you can lock it down later)
3. Choose the nearest region → **Enable**

### 3c — Get your Firebase config
1. Sidebar → **Project settings** (gear icon) → **General** tab
2. Scroll to **Your apps** → Click **</>** (Web app)
3. Register the app with any name → Copy the `firebaseConfig` object:
```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",   // ← important, must include this
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### 3d — Get your VAPID key (for web push)
1. Still in **Cloud Messaging → Web Push certificates**
2. Click **Generate key pair** → Copy the key string — this is your `VAPID_KEY`

---

## Step 4 — Fill In Your Config Files

### `js/config.js`
Open the file and replace every placeholder:

```javascript
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
  FIREBASE: {
    apiKey:            "AIza...",
    authDomain:        "your-project.firebaseapp.com",
    databaseURL:       "https://your-project-default-rtdb.firebaseio.com",
    projectId:         "your-project",
    storageBucket:     "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId:             "1:123:web:abc"
  },
  VAPID_KEY: "BL5...",
  APP_NAME:  "TeamChat"
};
```

### `firebase-messaging-sw.js`
Also paste the SAME Firebase config into the `firebase.initializeApp({...})` call near the top of this file (it can't import config.js).

### `js/auth.js` in Google Apps Script
Go back to your Apps Script and fill in:
```javascript
const SHEET_ID       = '1abc...xyz';   // your Sheet ID from Step 1
const FCM_SERVER_KEY = 'AAAA...';      // from Step 3d
```
Then **re-deploy** (Deploy → Manage deployments → edit → New version → Deploy).

---

## Step 5 — Deploy to GitHub Pages

1. Create a free account at [github.com](https://github.com) if you don't have one
2. Click **New repository** → name it `teamchat` → **Create repository**
3. Upload ALL the files (keeping the folder structure):
   ```
   teamchat/
   ├── index.html
   ├── chat.html
   ├── firebase-messaging-sw.js   ← must be at root
   ├── js/
   │   ├── config.js
   │   ├── auth.js
   │   └── chat.js
   └── SETUP_GUIDE.md
   ```
   You can drag-and-drop files on GitHub's web interface.
4. Go to **Settings → Pages → Source → Deploy from branch → main → / (root) → Save**
5. Wait ~1 minute. Your app is now live at:
   ```
   https://YOUR_USERNAME.github.io/teamchat/
   ```

---

## Testing

1. Open the URL above in Chrome on desktop
2. Log in with a User ID and Password from your Google Sheet
3. Open a second browser window / incognito tab, log in as a different user
4. Send a message from one — it should appear in real time in the other
5. For push notifications: minimise or close the tab, send a message from another device

---

## How Push Notifications Work

```
User A sends message
       │
       ▼
Firebase saves message (both see it in real time)
       │
       ▼
User A's browser → calls Google Apps Script
       │
       ▼
Apps Script → calls FCM (Firebase Cloud Messaging)
       │
       ▼
FCM → sends push to User B's device
       │
   ┌───┴───────────────────┐
   │ App open?             │ App closed/minimised?
   ▼                       ▼
Firebase onMessage()   Service Worker shows
shows in-app banner    OS notification
+ beep sound           + sound
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Could not connect" on login | Check Apps Script URL in config.js; re-deploy Apps Script |
| Messages not appearing | Check Firebase databaseURL in config.js (must include `https://`) |
| No push notifications | Make sure you allowed notifications in browser; check VAPID_KEY |
| "Invalid ID" error | Passwords in Sheet are case-sensitive; trim any spaces |
| Works on desktop but not mobile | Open the URL in mobile Chrome, allow notifications when prompted |

---

## Security Note

Passwords in the Google Sheet are stored as plain text. For a more secure setup, consider:
- Hashing passwords in the sheet (sha256)
- Restricting Google Sheet access to just your Apps Script
- Adding Firebase security rules to restrict DB read/write

For a small trusted team this setup is practical and fast to maintain.
