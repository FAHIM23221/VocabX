// Firebase ইনিশিয়ালাইজেশন — সব পেজ এই ফাইল থেকে auth আর db ইম্পোর্ট করে
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD02eI-xx3Ht65p-bWHlvynDt9t0KMeYg4",
  authDomain: "vocabx-437d3.firebaseapp.com",
  projectId: "vocabx-437d3",
  storageBucket: "vocabx-437d3.firebasestorage.app",
  messagingSenderId: "799468982065",
  appId: "1:799468982065:web:80e5b49d669ce1c6676a10",
  measurementId: "G-57EC2SM3S7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
