# Vivan mobile (Expo)

Companion app scaffold for members: dashboard-style income summary, team counts, and income breakdown.

## Setup

From this folder:

```bash
npm install
npx expo start
```

Configure the API base URL in `src/services/api.ts` (or use `expo-constants` + `app.config.js` extra) so it points at your backend, for example `https://api.example.com/api`.

The web app already exposes authenticated wallet and referral endpoints; wire the screens to the routes you enable for mobile (JWT same as web).

## Stack

- Expo SDK 52
- React Navigation (native stack)
- Axios + Zustand (session store stub)
