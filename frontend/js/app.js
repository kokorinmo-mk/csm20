import { setupAuthListener } from './auth.js';
import { loadMaterialsTable } from './materials.js';
import { loadQuestionsFromGoogleSheets } from './test.js';
import { render } from './render.js';

// Инициализация приложения
async function init() {
    console.log('🚀 Запуск CSM 2.0');
    
    // Загружаем материалы в фоне
    loadMaterialsTable().catch(console.error);
    
    // Загружаем вопросы теста
    await loadQuestionsFromGoogleSheets();
    
    // Настраиваем слушатель авторизации
    setupAuthListener();
    
    // Первоначальный рендер
    render();
}

// Запускаем приложение
init();