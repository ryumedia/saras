import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  // Ganti nilai-nilai di bawah ini dengan konfigurasi dari Firebase Console Anda
  apiKey: "AIzaSyDLAqV692ZypeW-EeDANU0gnBdc-BPk9WM",
  authDomain: "saras-5a6b7.firebaseapp.com",
  projectId: "saras-5a6b7",
  storageBucket: "saras-5a6b7.firebasestorage.app",
  messagingSenderId: "293808197526",
  appId: "1:293808197526:web:8b09611e8c18d9d17597b7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);