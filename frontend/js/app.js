import { setupAuthListener } from './auth.js';
import { loadMaterialsTable } from './materials.js';
import { loadQuestionsFromGoogleSheets } from './test.js';
import { render } from './render.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';

async function init() {
    console.log('🚀 Запуск CSM 2.0');
    
    // Загружаем материалы в фоне
    loadMaterialsTable().catch(console.error);
    
    // Загружаем вопросы теста
    await loadQuestionsFromGoogleSheets();
    
    // Устанавливаем слушатель авторизации
    setupAuthListener();
    
    // Проверка: если пользователь уже был в localStorage, onAuthStateChanged восстановит его
    const currentAuthUser = auth.currentUser;
    if (currentAuthUser) {
        console.log("✅ User restored from localStorage:", currentAuthUser.email);
    }
    
    render();
}

init();