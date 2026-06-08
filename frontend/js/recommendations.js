import { currentUser, getCurrentUserName } from './auth.js';
import { userResults, saveRecommendationToFirestore, loadUserResults, getLastSelf, getLastTest } from './history.js';
import { AREA_NAMES, recRateLimiter, sanitizeHTML, cache } from './utils.js';
import { getMaterials, formatMaterialsForPrompt } from './materials.js';

const SERVER_URL = "https://csm-recommendations.onrender.com/recommend";

export let isGeneratingRec = false;

export function generateLocalRecommendations(testResult, userName) {
    let text = `**Персональные рекомендации для ${userName}**\n\n📊 **Результат теста:** ${testResult.overallScore}%\n\n`;
    
    const weakAreas = [];
    const strongAreas = [];
    
    for (let i = 0; i < testResult.areaScores.length; i++) {
        if (testResult.areaScores[i] < 60) {
            weakAreas.push(AREA_NAMES[i]);
        } else if (testResult.areaScores[i] >= 80) {
            strongAreas.push(AREA_NAMES[i]);
        }
    }
    
    if (weakAreas.length > 0) {
        text += `🔴 **Требуют внимания:**\n`;
        weakAreas.forEach(area => { text += `   • ${area}\n`; });
        text += `\n`;
    }
    
    if (strongAreas.length > 0) {
        text += `🟢 **Сильные стороны:**\n`;
        strongAreas.forEach(area => { text += `   • ${area}\n`; });
        text += `\n`;
    }
    
    text += `💡 **Рекомендации:**\n`;
    
    if (testResult.overallScore >= 80) {
        text += `• Отличный результат! Продолжайте развиваться и делитесь опытом.\n`;
    } else if (testResult.overallScore >= 60) {
        text += `• Хороший результат! Обратите внимание на слабые области.\n`;
    } else {
        text += `• Рекомендуется пройти обучение по компетенциям CSM.\n• Изучите материалы по областям, где результат ниже 60%\n`;
    }
    
    text += `\n📚 **Рекомендуемые материалы:**\n`;
    const materials = getMaterials();
    for (let i = 0; i < weakAreas.length && i < 2; i++) {
        const areaMaterials = materials.filter(m => m.area === weakAreas[i]);
        if (areaMaterials.length > 0) {
            text += `\n**${weakAreas[i]}:**\n`;
            areaMaterials.slice(0, 3).forEach(m => {
                text += `• [${m.name}](${m.url})\n`;
            });
        }
    }
    
    return text;
}

export async function generateRec() {
    const lastTest = getLastTest();
    if (!lastTest) {
        alert("Сначала пройдите тест!");
        return;
    }
    
    if (isGeneratingRec) {
        alert("Рекомендации уже генерируются, подождите...");
        return;
    }
    
    if (!recRateLimiter.canMakeRequest()) {
        alert("Слишком много запросов. Подождите минуту и попробуйте снова.");
        return;
    }
    
    isGeneratingRec = true;
    
    try {
        const lastSelf = getLastSelf();
        const lastSelfScores = lastSelf ? lastSelf.areaScores : [];
        
        console.log("🤖 Отправляем запрос на сервер...");
        
        const response = await fetch(SERVER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userName: getCurrentUserName(),
                userEmail: currentUser?.email || "",
                testScores: lastTest.areaScores,
                selfScores: lastSelfScores
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        let recommendationText = "";
        
        if (data.success && data.recommendations) {
            recommendationText = data.recommendations;
            console.log("✅ Рекомендации получены от сервера");
        } else {
            recommendationText = generateLocalRecommendations(lastTest, getCurrentUserName());
        }
        
        // Санитизируем перед сохранением
        recommendationText = sanitizeHTML(recommendationText);
        
        if (currentUser) {
            await saveRecommendationToFirestore(currentUser.uid, recommendationText);
            await loadUserResults(currentUser.uid);
        }
        
    } catch (error) {
        console.error("❌ Ошибка:", error);
        const fallbackText = generateLocalRecommendations(lastTest, getCurrentUserName());
        
        if (currentUser) {
            await saveRecommendationToFirestore(currentUser.uid, fallbackText);
            await loadUserResults(currentUser.uid);
        }
        
        alert("Не удалось подключиться к серверу. Рекомендации сгенерированы локально.");
    } finally {
        isGeneratingRec = false;
    }
}