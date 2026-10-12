// ============================================
// НАСТРОЙКА FIREBASE
// ============================================
// 1. Зайди на https://console.firebase.google.com
// 2. Создай проект → Добавь веб-приложение
// 3. Включи Authentication → Sign-in method → Google
// 4. Создай Firestore Database (режим test или production)
// 5. Вставь сюда свои данные из Project settings → Your apps
// ============================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// true = использовать реальный Firebase (если конфиг заполнен)
// false = только демо-режим (локальный вход + фейковый топ)
const USE_FIREBASE = false;
