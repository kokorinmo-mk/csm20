import { AREA_NAMES } from './utils.js';
import { currentUser, getCurrentUserName } from './auth.js';
import { saveResultToFirestore } from './history.js';

const TEST_QUESTIONS_URL = "https://script.google.com/macros/s/AKfycbymZueJVozXFoH2wxfJM3jAGXg08mhwrzVAQMKmpR7mm4XQWQKNe-AHYz-iryA8QVqUYg/exec";

export let testState = {
    answers: {},
    currentAreaIndex: 0,
    currentQuestionIndex: 0,
    isActive: false,
    result: null,
    areas: []
};

export let testAreas = [];

export async function loadQuestionsFromGoogleSheets() {
    try {
        const response = await fetch(TEST_QUESTIONS_URL);
        const serverAreas = await response.json();
        testAreas = convertServerAreasToTestAreas(serverAreas);
        console.log(`📝 Загружено ${testAreas.length} областей тестирования`);
        return testAreas;
    } catch (error) {
        console.error("Ошибка загрузки тестов:", error);
        return [];
    }
}

function convertServerAreasToTestAreas(serverAreas) {
    let result = [];
    let questionId = 1;
    
    for (let areaId = 0; areaId < serverAreas.length; areaId++) {
        const serverArea = serverAreas[areaId];
        let questions = [];
        
        for (let q of serverArea.closed) {
            const correctIndex = getIndexFromLetter(q.correct);
            const correctAnswerText = (correctIndex >= 0 && correctIndex < q.options.length) ? 
                q.options[correctIndex] : (q.options[0] || "");
            
            questions.push({
                id: questionId++,
                text: q.text,
                options: q.options,
                correctAnswer: correctAnswerText,
                areaId: areaId + 1
            });
        }
        
        result.push({
            id: areaId + 1,
            name: serverArea.name,
            questions: questions
        });
    }
    
    return result;
}

function getIndexFromLetter(letter) {
    const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    return map[letter.trim().toUpperCase()] ?? -1;
}

export function startTest() {
    if (testAreas.length === 0) {
        loadQuestionsFromGoogleSheets().then(() => {
            initTestState();
        });
    } else {
        initTestState();
    }
}

function initTestState() {
    testState = {
        answers: {},
        currentAreaIndex: 0,
        currentQuestionIndex: 0,
        isActive: true,
        result: null,
        areas: JSON.parse(JSON.stringify(testAreas))
    };
}

export function selectAnswer(id, answer) {
    testState.answers[id] = answer;
}

export function nextQuestion() {
    let area = testState.areas[testState.currentAreaIndex];
    if (testState.currentQuestionIndex + 1 < area.questions.length) {
        testState.currentQuestionIndex++;
    } else if (testState.currentAreaIndex + 1 < testState.areas.length) {
        testState.currentAreaIndex++;
        testState.currentQuestionIndex = 0;
    } else {
        finishTest();
    }
}

export function prevQuestion() {
    if (testState.currentQuestionIndex > 0) {
        testState.currentQuestionIndex--;
    } else if (testState.currentAreaIndex > 0) {
        testState.currentAreaIndex--;
        testState.currentQuestionIndex = testState.areas[testState.currentAreaIndex].questions.length - 1;
    }
}

export async function finishTest() {
    let areaScores = [];
    
    for (let area of testState.areas) {
        let correct = 0;
        for (let q of area.questions) {
            if (testState.answers[q.id] === q.correctAnswer) correct++;
        }
        areaScores.push(Math.round((correct / area.questions.length) * 100));
    }
    
    let overall = Math.round(areaScores.reduce((a, b) => a + b, 0) / areaScores.length);
    
    let result = {
        id: Date.now(),
        date: new Date(),
        areaScores: areaScores,
        overallScore: overall,
        recommendations: "",
        type: 'test'
    };
    
    if (currentUser) {
        await saveResultToFirestore(currentUser.uid, result);
    }
    
    testState.result = result;
    testState.isActive = false;
}

export function getTotalQuestions() {
    return testState.areas.reduce((s, a) => s + a.questions.length, 0);
}

export function getAnsweredCount() {
    return Object.keys(testState.answers).length;
}

export function getTestProgress() {
    const total = getTotalQuestions();
    return total ? (getAnsweredCount() / total) * 100 : 0;
}

export function getCurrentQuestion() {
    return testState.areas[testState.currentAreaIndex]?.questions[testState.currentQuestionIndex];
}

export function resetTest() {
    testState = {
        answers: {},
        currentAreaIndex: 0,
        currentQuestionIndex: 0,
        isActive: false,
        result: null,
        areas: []
    };
}