import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Твої ключі з Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCN4EP8gmJUujyI0oEEYrtVKv92Qujg1kU",
  authDomain: "deadline-warden.firebaseapp.com",
  projectId: "deadline-warden",
  storageBucket: "deadline-warden.firebasestorage.app",
  messagingSenderId: "537336173596",
  appId: "1:537336173596:web:dff47c025f276e5cd37bd9",
  measurementId: "G-QWY074CVSY"
};

// Ініціалізація Firebase
const app = initializeApp(firebaseConfig);

// ЕКСПОРТУЄМО auth та db, щоб App.jsx та Auth.jsx могли з ними працювати!
export const auth = getAuth(app);
export const db = getFirestore(app);