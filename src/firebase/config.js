import { getApps, initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyAEn6Wa52kF9SeJmJIdfYpvij5UzRG_je4",
  authDomain: "motorprotection-5094b.firebaseapp.com",
  databaseURL: "https://motorprotection-5094b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "motorprotection-5094b",
  storageBucket: "motorprotection-5094b.firebasestorage.app",
  messagingSenderId: "28573683287",
  appId: "1:28573683287:web:2484aa94e9dd9747dcdd12",
  measurementId: "G-K28FF3HL2K"
};


const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const database = getDatabase(app)
export const auth = getAuth(app)


