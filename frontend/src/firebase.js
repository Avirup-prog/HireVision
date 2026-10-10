import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBUhXEto6mck4nmYdrcA_DC14O4yNYF6Ik",
  authDomain: "hirevision-5c3d2.firebaseapp.com",
  projectId: "hirevision-5c3d2",
  storageBucket: "hirevision-5c3d2.firebasestorage.app",
  messagingSenderId: "55572859031",
  appId: "1:55572859031:web:46b358980a99a1cbd241d2",
  measurementId: "G-CR77MX5K21"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
