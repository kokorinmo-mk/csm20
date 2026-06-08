import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy, limit, startAfter, Timestamp, doc } from "firebase/firestore";
import { formatDate } from './utils.js';

export let userResults = {
    testResults: [],
    selfResults: [],
    recommendations: []
};

let lastTestDoc = null;
let lastSelfDoc = null;
let hasMoreTest = true;
let hasMoreSelf = true;
const PAGE_SIZE = 10;

export async function loadUserResults(uid, loadMore = false) {
    try {
        if (!loadMore) {
            userResults.testResults = [];
            userResults.selfResults = [];
            userResults.recommendations = [];
            lastTestDoc = null;
            lastSelfDoc = null;
            hasMoreTest = true;
            hasMoreSelf = true;
        }
        
        // Загружаем тесты с пагинацией
        if (hasMoreTest) {
            let testQuery = query(
                collection(db, "users", uid, "testResults"),
                orderBy("date", "desc"),
                limit(PAGE_SIZE)
            );
            
            if (lastTestDoc) {
                testQuery = query(testQuery, startAfter(lastTestDoc));
            }
            
            const testSnapshot = await getDocs(testQuery);
            lastTestDoc = testSnapshot.docs[testSnapshot.docs.length - 1];
            hasMoreTest = testSnapshot.docs.length === PAGE_SIZE;
            
            for (const docSnap of testSnapshot.docs) {
                const data = docSnap.data();
                userResults.testResults.push({
                    id: docSnap.id,
                    date: data.date?.toDate() || new Date(),
                    areaScores: data.areaScores || [],
                    overallScore: data.overallScore || 0,
                    recommendations: data.recommendations || "",
                    type: 'test'
                });
            }
        }
        
        // Загружаем самооценки с пагинацией
        if (hasMoreSelf) {
            let selfQuery = query(
                collection(db, "users", uid, "selfAssessmentResults"),
                orderBy("date", "desc"),
                limit(PAGE_SIZE)
            );
            
            if (lastSelfDoc) {
                selfQuery = query(selfQuery, startAfter(lastSelfDoc));
            }
            
            const selfSnapshot = await getDocs(selfQuery);
            lastSelfDoc = selfSnapshot.docs[selfSnapshot.docs.length - 1];
            hasMoreSelf = selfSnapshot.docs.length === PAGE_SIZE;
            
            for (const docSnap of selfSnapshot.docs) {
                const data = docSnap.data();
                userResults.selfResults.push({
                    id: docSnap.id,
                    date: data.date?.toDate() || new Date(),
                    areaScores: data.areaScores || [],
                    overallScore: data.overallScore || 0,
                    recommendations: data.recommendations || "",
                    type: 'self'
                });
            }
        }
        
        // Загружаем рекомендации без пагинации (обычно их меньше)
        const recQuery = query(
            collection(db, "users", uid, "recommendations"),
            orderBy("date", "desc"),
            limit(20)
        );
        const recSnapshot = await getDocs(recQuery);
        for (const docSnap of recSnapshot.docs) {
            const data = docSnap.data();
            userResults.recommendations.push({
                id: docSnap.id,
                date: data.date?.toDate() || new Date(),
                text: data.recommendations || data.text || "",
                type: 'recommendation'
            });
        }
        
        console.log(`📊 Загружено: тестов=${userResults.testResults.length}, самооценок=${userResults.selfResults.length}, рекомендаций=${userResults.recommendations.length}`);
        
    } catch (error) {
        console.error("Ошибка загрузки:", error);
    }
}

export async function saveResultToFirestore(uid, result) {
    try {
        let collectionName;
        if (result.type === 'test') {
            collectionName = 'testResults';
        } else if (result.type === 'self') {
            collectionName = 'selfAssessmentResults';
        } else {
            collectionName = 'results';
        }
        
        const savedDoc = await addDoc(collection(db, "users", uid, collectionName), {
            type: result.type,
            date: Timestamp.now(),
            overallScore: result.type === 'test' ? result.overallScore : Math.round(result.overallScore * 10),
            areaScores: result.areaScores.map(s => Math.round(s)),
            recommendations: result.recommendations || ""
        });
        
        // Добавляем ID к результату
        result.id = savedDoc.id;
        
        // Обновляем локальный кэш
        if (result.type === 'test') {
            userResults.testResults.unshift(result);
            if (userResults.testResults.length > 50) userResults.testResults.pop();
        } else if (result.type === 'self') {
            userResults.selfResults.unshift(result);
            if (userResults.selfResults.length > 50) userResults.selfResults.pop();
        }
        
    } catch (error) {
        console.error("Ошибка сохранения:", error);
    }
}

export async function saveRecommendationToFirestore(uid, text) {
    try {
        const savedDoc = await addDoc(collection(db, "users", uid, "recommendations"), {
            date: Timestamp.now(),
            recommendations: text,
            type: "recommendation"
        });
        
        userResults.recommendations.unshift({
            id: savedDoc.id,
            date: new Date(),
            text: text,
            type: 'recommendation'
        });
        
        if (userResults.recommendations.length > 50) userResults.recommendations.pop();
        
    } catch (error) {
        console.error("Ошибка сохранения рекомендации:", error);
    }
}

export function getAllHistory() {
    let testItems = userResults.testResults.map(r => ({
        ...r,
        typeName: 'Тест',
        icon: '📝',
        type: 'test'
    }));
    
    let selfItems = userResults.selfResults.map(r => ({
        ...r,
        typeName: 'Самооценка',
        icon: '📊',
        type: 'self'
    }));
    
    return [...testItems, ...selfItems].sort((a, b) => b.date - a.date);
}

export function getLastTest() {
    return userResults.testResults[0] || null;
}

export function getLastSelf() {
    return userResults.selfResults[0] || null;
}

export function loadMoreHistory(uid) {
    if (hasMoreTest || hasMoreSelf) {
        loadUserResults(uid, true);
    }
}

export function hasMoreHistory() {
    return hasMoreTest || hasMoreSelf;
}