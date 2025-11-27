// src/firebase.js
import { initializeApp } from "firebase/app";
// 1. CAMBIO: Importamos Firestore (Base de datos) en vez de Analytics
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// 2. CAMBIO: Inicializamos la base de datos y la EXPORTAMOS
// Esta es la "db" que App.jsx estaba buscando y no encontraba
export const db = getFirestore(app);