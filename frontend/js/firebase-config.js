import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBir4RPFm_SqEOob0vjemiw4XXjSbc7v70",
    authDomain: "csm20-4a73d.firebaseapp.com",
    projectId: "csm20-4a73d",
    storageBucket: "csm20-4a73d.firebasestorage.app",
    messagingSenderId: "921600350045",
    appId: "1:921600350045:web:dad035e72b219709693ab4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);