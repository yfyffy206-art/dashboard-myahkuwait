const firebaseConfig = window.__FIREBASE_CONFIG__;

if (!firebaseConfig?.apiKey) {
  throw new Error("Firebase config is missing. Check the environment variables.");
}

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const rtd = firebase.database();
window.db = db;
window.rtd = rtd;
