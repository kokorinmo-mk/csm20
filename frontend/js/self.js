import { AREA_NAMES } from './utils.js';
import { currentUser } from './auth.js';
import { saveResultToFirestore } from './history.js';

export const SELF_ASSESSMENT_AREAS = [
    { name: "Область 1. Осознание (тренды)", questions: [
        "Понимаю тренды: AI, Big Data, IoT, Cloud",
        "Понимаю цели цифровой трансформации",
        "Знаю отраслевые кейсы"
    ]},
    { name: "Область 2. Стратегия", questions: [
        "Мыслю стратегически на 3-5 лет",
        "Знаю стратегию компании",
        "Могу описать бизнес-модель",
        "Нахожу точки роста",
        "Понимаю цифровые роли",
        "Разделяю человекоцентричность"
    ]},
    { name: "Область 3. Реинжиниринг", questions: [
        "Понимаю цели исследований",
        "Владею бизнес-анализом",
        "Могу создать CJM",
        "Знаю цифровые продукты",
        "Понимаю IT-архитектуру",
        "Могу оценить экономику"
    ]},
    { name: "Область 4. Проектирование", questions: [
        "Владею продуктовым менеджментом",
        "Владею проектным менеджментом",
        "Понимаю разработку ПО",
        "Знаю партнёрскую программу"
    ]},
    { name: "Область 5. Внедрение", questions: [
        "Знаю форматы партнёрств",
        "Понимаю процессы внедрения"
    ]},
    { name: "Область 6. Методология", questions: [
        "Знаю процесс трансформации",
        "Владею инструментами CSM",
        "Использую GigaChat",
        "Понимаю мотивацию"
    ]},
    { name: "Область 7. Отраслевые", questions: [
        "Анализирую рынок",
        "Знаю специфику отрасли",
        "Ориентируюсь в продуктах"
    ]},
    { name: "Область 8. Soft skills", questions: [
        "Владею системным мышлением",
        "Управляю результатом",
        "Управляю собой"
    ]}
];

export let selfState = {
    ratings: {},
    currentAreaIndex: 0,
    currentQuestionIndex: 0,
    isActive: false,
    result: null
};

export function startSelf() {
    selfState = {
        ratings: {},
        currentAreaIndex: 0,
        currentQuestionIndex: 0,
        isActive: true,
        result: null
    };
}

export function setSelfRating(areaIdx, questionIdx, rating) {
    selfState.ratings[`${areaIdx}-${questionIdx}`] = rating;
}

export function nextSelf() {
    let area = SELF_ASSESSMENT_AREAS[selfState.currentAreaIndex];
    if (selfState.currentQuestionIndex + 1 < area.questions.length) {
        selfState.currentQuestionIndex++;
    } else if (selfState.currentAreaIndex + 1 < SELF_ASSESSMENT_AREAS.length) {
        selfState.currentAreaIndex++;
        selfState.currentQuestionIndex = 0;
    } else {
        finishSelf();
    }
}

export function prevSelf() {
    if (selfState.currentQuestionIndex > 0) {
        selfState.currentQuestionIndex--;
    } else if (selfState.currentAreaIndex > 0) {
        selfState.currentAreaIndex--;
        selfState.currentQuestionIndex = SELF_ASSESSMENT_AREAS[selfState.currentAreaIndex].questions.length - 1;
    }
}

export async function finishSelf() {
    let areaScores = [];
    
    for (let a = 0; a < SELF_ASSESSMENT_AREAS.length; a++) {
        let sum = 0, count = 0;
        for (let q = 0; q < SELF_ASSESSMENT_AREAS[a].questions.length; q++) {
            let r = selfState.ratings[`${a}-${q}`];
            if (r) {
                sum += r;
                count++;
            }
        }
        areaScores.push(count > 0 ? sum / count : 0);
    }
    
    let overall = areaScores.reduce((a, b) => a + b, 0) / areaScores.length;
    
    let result = {
        id: Date.now(),
        date: new Date(),
        areaScores: areaScores,
        overallScore: overall,
        recommendations: "",
        type: 'self'
    };
    
    if (currentUser) {
        await saveResultToFirestore(currentUser.uid, result);
    }
    
    selfState.result = result;
    selfState.isActive = false;
}

export function getTotalSelf() {
    return SELF_ASSESSMENT_AREAS.reduce((s, a) => s + a.questions.length, 0);
}

export function getAnsweredSelf() {
    return Object.keys(selfState.ratings).length;
}

export function getSelfProgress() {
    const total = getTotalSelf();
    return total ? (getAnsweredSelf() / total) * 100 : 0;
}

export function getCurrentSelf() {
    return SELF_ASSESSMENT_AREAS[selfState.currentAreaIndex]?.questions[selfState.currentQuestionIndex];
}

export function getCurrentRating() {
    return selfState.ratings[`${selfState.currentAreaIndex}-${selfState.currentQuestionIndex}`];
}

export function resetSelf() {
    selfState = {
        ratings: {},
        currentAreaIndex: 0,
        currentQuestionIndex: 0,
        isActive: false,
        result: null
    };
}