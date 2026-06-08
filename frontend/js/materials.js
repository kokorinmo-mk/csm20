import { cache } from './utils.js';

let materialsCache = [];

export async function loadMaterialsTable() {
    // Проверяем кэш
    const cached = cache.get('materials');
    if (cached) {
        materialsCache = cached;
        console.log(`📚 Загружено из кэша: ${materialsCache.length} материалов`);
        return materialsCache;
    }
    
    try {
        const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vQgRTJT7A9uBDdCNuqobPEI9-PRHqv2o2zcIJtx0wi4iFy4BGwSte5-kSZMhp8zJiI-MpMKZ80T6BKP/pub?output=csv");
        const csvText = await response.text();
        const rows = csvText.split('\n');
        
        materialsCache = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cols = [];
            let inQuote = false;
            let current = '';
            
            for (let j = 0; j < row.length; j++) {
                const char = row[j];
                if (char === '"') {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    cols.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            cols.push(current.trim());
            
            if (cols.length >= 3 && cols[0] && cols[1] && cols[2] && cols[2].startsWith('http')) {
                materialsCache.push({
                    area: cols[0].replace(/^"|"$/g, ''),
                    name: cols[1].replace(/^"|"$/g, ''),
                    url: cols[2].replace(/^"|"$/g, ''),
                    type: cols[1].includes('[Курс]') ? 'course' : 
                           (cols[1].includes('[Статья]') ? 'article' : 'video')
                });
            }
        }
        
        // Сохраняем в кэш на 5 минут
        cache.set('materials', materialsCache, 300000);
        console.log(`📚 Загружено ${materialsCache.length} материалов`);
        return materialsCache;
    } catch (error) {
        console.error("Ошибка загрузки таблицы:", error);
        return [];
    }
}

export function getMaterials() {
    return materialsCache;
}

export function getMaterialsByArea(area) {
    return materialsCache.filter(m => m.area === area);
}

export function formatMaterialsForPrompt() {
    if (materialsCache.length === 0) return "";
    
    const grouped = {};
    for (const material of materialsCache) {
        if (!grouped[material.area]) grouped[material.area] = [];
        grouped[material.area].push(material);
    }
    
    let result = "";
    for (const [area, materials] of Object.entries(grouped)) {
        result += `\n### ${area}\n`;
        for (const m of materials.slice(0, 5)) {
            result += `${m.name} | ${m.url}\n`;
        }
    }
    return result;
}