import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { validateEmail } from './utils.js';
import { loadUserResults } from './history.js';
import { render } from './render.js';

export let currentUser = null;
export let currentUserName = "Пользователь";

export async function handleLogin(email, password) {
    if (!validateEmail(email)) {
        alert("Введите корректный email");
        return false;
    }
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        await loadUserResults(currentUser.uid);
        
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        currentUserName = userDoc.exists() ? 
            (userDoc.data().fullName || currentUser.email || "Пользователь") : 
            (currentUser.email || "Пользователь");
        
        render();
        return true;
    } catch (error) {
        alert(getAuthErrorMessage(error.code));
        return false;
    }
}

export async function handleRegister(email, password, fullName) {
    if (!fullName) {
        alert("Введите ваше имя");
        return false;
    }
    
    if (!validateEmail(email)) {
        alert("Введите корректный email");
        return false;
    }
    
    if (password.length < 6) {
        alert("Пароль должен быть не менее 6 символов");
        return false;
    }
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        
        await setDoc(doc(db, "users", currentUser.uid), {
            email: email,
            fullName: fullName,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        currentUserName = fullName;
        await loadUserResults(currentUser.uid);
        render();
        return true;
    } catch (error) {
        alert(getAuthErrorMessage(error.code));
        return false;
    }
}

export async function handleLogout() {
    try {
        await signOut(auth);
        currentUser = null;
        currentUserName = "Пользователь";
        render();
    } catch (error) {
        console.error("Ошибка выхода:", error);
    }
}

export function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadUserResults(user.uid);
            
            const userDoc = await getDoc(doc(db, "users", user.uid));
            currentUserName = userDoc.exists() ? 
                (userDoc.data().fullName || user.email || "Пользователь") : 
                (user.email || "Пользователь");
        } else {
            currentUser = null;
            currentUserName = "Пользователь";
        }
        render();
    });
}

function getAuthErrorMessage(code) {
    const messages = {
        'auth/invalid-email': 'Неверный формат email',
        'auth/user-disabled': 'Аккаунт отключен',
        'auth/user-not-found': 'Пользователь не найден',
        'auth/wrong-password': 'Неверный пароль',
        'auth/email-already-in-use': 'Email уже используется',
        'auth/weak-password': 'Слишком слабый пароль'
    };
    return messages[code] || 'Ошибка авторизации. Попробуйте снова.';
}

export function getCurrentUser() { return currentUser; }
export function getCurrentUserName() { return currentUserName; }