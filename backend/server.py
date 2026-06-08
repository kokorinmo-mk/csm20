#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import os
import requests
import time
from functools import wraps
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# ========== КОНФИГУРАЦИЯ ==========
QWEN_API_KEY = os.environ.get("QWEN_API_KEY", "")
QWEN_BASE_URL = "https://openrouter.ai/api/v1"

# Бесплатные модели в порядке приоритета
FREE_MODELS = [
    "nvidia/nemotron-3-super",
    "google/gemma-4-31b-it:free",
    "minimax/minimax-m2.5",
    "qwen/qwen3-8b:free",
    "mistralai/mistral-7b-instruct:free",
]

MATERIALS_URL = "https://script.google.com/macros/s/AKfycbzOlrBj4ZY5iqStx3gUiF3Duecu0W8X26BfFsvNWJ6CoRLU7Hf2B7jDHnLVX4qE9m9w/exec"

# Кэш материалов
materials_cache = {"data": "", "timestamp": 0}
CACHE_TTL = 300  # 5 минут

# Rate limiting
rate_limit_store = {}
RATE_LIMIT = 3  # запроса
RATE_WINDOW = 60  # секунд

# Названия областей
AREA_NAMES = [
    "Осознание", "Стратегия", "Реинжиниринг", "Проектирование",
    "Внедрение", "Методология", "Отраслевые", "Soft skills"
]

# ========== ДЕКОРАТОРЫ ==========

def rate_limit(f):
    """Ограничение частоты запросов"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = request.remote_addr
        now = datetime.now()
        
        if client_ip not in rate_limit_store:
            rate_limit_store[client_ip] = []
        
        # Очищаем старые записи
        rate_limit_store[client_ip] = [
            req_time for req_time in rate_limit_store[client_ip]
            if now - req_time < timedelta(seconds=RATE_WINDOW)
        ]
        
        if len(rate_limit_store[client_ip]) >= RATE_LIMIT:
            return jsonify({
                "success": False,
                "error": f"Слишком много запросов. Подождите {RATE_WINDOW} секунд."
            }), 429
        
        rate_limit_store[client_ip].append(now)
        return f(*args, **kwargs)
    return decorated_function


# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

def get_client():
    """Создаёт клиент OpenAI для OpenRouter"""
    if not QWEN_API_KEY:
        return None
    return OpenAI(api_key=QWEN_API_KEY, base_url=QWEN_BASE_URL)


def load_materials():
    """Загружает материалы из Google Sheets с кэшированием"""
    current_time = time.time()
    
    # Проверяем кэш
    if materials_cache["data"] and (current_time - materials_cache["timestamp"] < CACHE_TTL):
        print("📚 Использую кэшированные материалы")
        return materials_cache["data"]
    
    try:
        print("🔄 Загружаю материалы из Google Sheets...")
        response = requests.get(MATERIALS_URL, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        result = []
        for area, items in data.items():
            result.append(f"\n### {area}")
            for item in items[:5]:  # Берём максимум 5 материалов на область
                result.append(f"{item['name']} | {item['url']}")
        
        materials_cache["data"] = "\n".join(result)
        materials_cache["timestamp"] = current_time
        
        print(f"✅ Загружено материалов: {len(result)} строк")
        return materials_cache["data"]
        
    except Exception as e:
        print(f"❌ Ошибка загрузки материалов: {e}")
        # Возвращаем кэшированные данные если есть
        return materials_cache["data"] or ""


def get_recommendations_from_model(model_id, prompt):
    """Пытается получить ответ от указанной модели"""
    print(f"   🤖 Пробую модель: {model_id}...")
    
    try:
        client = get_client()
        if not client:
            print(f"   ❌ Нет API ключа")
            return None
        
        # Добавляем system message для лучшего результата
        messages = [
            {"role": "system", "content": "Ты — эксперт по компетенциям CSM 2.0. Отвечай только на русском языке, используй формат Markdown. Не используй HTML теги."},
            {"role": "user", "content": prompt}
        ]
        
        response = client.chat.completions.create(
            model=model_id,
            messages=messages,
            temperature=0.7,
            max_tokens=3000,
            timeout=60,  # Уменьшил таймаут для быстрого перебора
        )
        
        recommendations = response.choices[0].message.content
        print(f"   ✅ Модель {model_id} ответила успешно (длина: {len(recommendations)} символов)")
        return recommendations
        
    except Exception as e:
        print(f"   ❌ Модель {model_id} не отвечает: {str(e)[:100]}")
        return None


def generate_local_fallback(user_name, test_scores, self_scores=None):
    """Генерирует локальные рекомендации если AI недоступен"""
    
    # Находим слабые области (тест < 60%)
    weak_areas = []
    for i, score in enumerate(test_scores):
        if score < 60:
            weak_areas.append((i, score))
    
    # Сортируем по возрастанию (самые слабые первые)
    weak_areas.sort(key=lambda x: x[1])
    
    # Берём топ-3
    top_areas = weak_areas[:3]
    
    if not top_areas:
        # Если нет слабых областей, берём самые низкие из всех
        all_areas = [(i, score) for i, score in enumerate(test_scores)]
        all_areas.sort(key=lambda x: x[1])
        top_areas = all_areas[:3]
    
    recommendations = f"**{user_name}**, ваши результаты теста CSM 2.0:\n\n"
    
    for area_idx, score in top_areas:
        recommendations += f"**{AREA_NAMES[area_idx]}**\n"
        recommendations += f"📊 Тест: {score}%"
        
        if self_scores and area_idx < len(self_scores):
            recommendations += f" | Самооценка: {self_scores[area_idx]:.1f}/10"
            gap = test_scores[area_idx] - (self_scores[area_idx] * 10)
            recommendations += f" | Разрыв: {gap:+.1f}%\n"
        else:
            recommendations += "\n"
        
        recommendations += "📚 Рекомендуем изучить:\n"
        recommendations += "**[Курсы]**\n"
        
        # Подбираем уровень сложности
        if score < 40:
            recommendations += "• [Введение в CSM для начинающих](https://example.com/basic-course)\n"
            recommendations += "• [Базовые компетенции CSM](https://example.com/fundamentals)\n"
            recommendations += "• [Практикум: первые шаги](https://example.com/practice-beginner)\n"
        elif score < 70:
            recommendations += "• [Продвинутый курс CSM](https://example.com/advanced-course)\n"
            recommendations += "• [Методологии оценки компетенций](https://example.com/methodologies)\n"
            recommendations += "• [Кейсы из практики](https://example.com/cases)\n"
        else:
            recommendations += "• [Экспертный уровень CSM](https://example.com/expert-course)\n"
            recommendations += "• [Стратегии развития команды](https://example.com/team-strategies)\n"
            recommendations += "• [Инновации в CSM](https://example.com/innovations)\n"
        
        recommendations += "**[Статьи]**\n"
        recommendations += "• [Как улучшить компетенции CSM](https://example.com/article1)\n"
        recommendations += "• [10 советов для CSM-специалиста](https://example.com/article2)\n"
        recommendations += "• [Тренды в оценке персонала](https://example.com/article3)\n"
        
        recommendations += "**[Видео]**\n"
        recommendations += "• [Лекция: Основы CSM](https://example.com/video1)\n"
        recommendations += "• [Вебинар: Практические инструменты](https://example.com/video2)\n"
        recommendations += "• [Мастер-класс: Разбор кейсов](https://example.com/video3)\n\n"
    
    recommendations += "---\n"
    recommendations += "💡 **Примечание:** Это базовые рекомендации. "
    recommendations += "Для получения персонализированных рекомендаций с актуальными материалами, "
    recommendations += "пожалуйста, попробуйте позже, когда AI сервис станет доступен."
    
    return recommendations


def build_prompt(user_name, user_email, test_scores, self_scores=None):
    """Строит промпт для AI модели"""
    
    has_self = self_scores and len(self_scores) == 8
    
    # Строим таблицу результатов
    scores_text = ""
    for i, name in enumerate(AREA_NAMES):
        line = f"{name}: тест {test_scores[i]}%"
        if has_self:
            self_pct = round(self_scores[i] * 10)
            gap = test_scores[i] - self_pct
            gap_str = f"+{gap}%" if gap >= 0 else f"{gap}%"
            line += f" | самооценка {self_scores[i]:.1f}/10 ({self_pct}%) | разрыв {gap_str}"
        scores_text += line + "\n"
    
    # Загружаем материалы
    materials_csv = load_materials()
    
    # Инструкция по разрыву
    gap_instruction = ""
    if has_self:
        gap_instruction = """
- Учитывай разрыв между самооценкой и тестом при выборе сложности материалов:
  • Тест сильно ниже самооценки (разрыв < -20%) — человек переоценивает себя, начни с базовых материалов
  • Тест выше самооценки (разрыв > +10%) — человек недооценивает себя, можно предложить более продвинутые материалы
  • Разрыв в пределах ±20% — подбирай материалы среднего уровня
"""
    
    prompt = f"""Ты — эксперт по компетенциям CSM 2.0.

### ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
Имя: {user_name}
Email: {user_email}

Результаты по областям:
{scores_text}

### ДОСТУПНЫЕ МАТЕРИАЛЫ:
{materials_csv if materials_csv else "Материалы временно недоступны. Используй общие рекомендации."}

### ЗАДАЧА:
1. Найди области с результатом теста < 100%
2. Отсортируй их по возрастанию процента теста (худшие — первые)
3. Возьми первые 3 области
4. Для каждой выбери из списка материалов: 3 курса, 3 статьи, 3 видео
{gap_instruction}
### ФОРМАТ ОТВЕТА:

{user_name}, ваши результаты теста CSM 2.0:

**[Название области]**
📊 Тест: X%{' | Самооценка: Y/10' if has_self else ''}
📚 Рекомендуем изучить:
**[Курсы]**
• [Название](ссылка)
• [Название](ссылка)
• [Название](ссылка)
**[Статьи]**
• [Название](ссылка)
• [Название](ссылка)
• [Название](ссылка)
**[Видео]**
• [Название](ссылка)
• [Название](ссылка)
• [Название](ссылка)

### ПРАВИЛА:
- Ровно 3 области — не больше, не меньше
- Только ссылки из списка материалов выше
- Формат ссылок строго: [Название](URL)
- Никаких советов и выводов после блоков
- Только русский язык
- Не используй HTML теги
"""
    
    return prompt


# ========== API ENDPOINTS ==========

@app.route("/", methods=["GET"])
def index():
    """Главная страница API"""
    return jsonify({
        "status": "ok",
        "name": "CSM 2.0 Recommendations API",
        "version": "2.1.0",
        "description": "API для генерации персональных рекомендаций по компетенциям CSM",
        "endpoints": {
            "/": "Информация об API",
            "/health": "Проверка здоровья сервера",
            "/recommend": "POST - Генерация рекомендаций",
            "/models": "GET - Список доступных моделей",
            "/materials/refresh": "POST - Обновление кэша материалов"
        }
    })


@app.route("/health", methods=["GET"])
def health():
    """Проверка здоровья сервера"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "has_api_key": bool(QWEN_API_KEY),
        "models_available": len(FREE_MODELS),
        "models_list": FREE_MODELS,
        "materials_loaded": bool(materials_cache["data"]),
        "materials_cache_age": int(time.time() - materials_cache["timestamp"]) if materials_cache["timestamp"] else 0
    })


@app.route("/models", methods=["GET"])
def list_models():
    """Возвращает список доступных моделей"""
    return jsonify({
        "models": FREE_MODELS,
        "default_model": FREE_MODELS[0] if FREE_MODELS else None,
        "total_models": len(FREE_MODELS)
    })


@app.route("/materials/refresh", methods=["POST"])
def refresh_materials():
    """Принудительное обновление кэша материалов"""
    global materials_cache
    materials_cache = {"data": "", "timestamp": 0}
    load_materials()
    return jsonify({
        "success": True,
        "message": "Кэш материалов обновлён",
        "materials_loaded": bool(materials_cache["data"])
    })


@app.route("/recommend", methods=["POST"])
@rate_limit
def recommend():
    """
    Генерация рекомендаций на основе результатов теста и самооценки.
    
    Ожидает JSON:
    {
        "userName": "Иван Иванов",
        "userEmail": "ivan@example.com",
        "testScores": [80, 60, 40, 70, 90, 50, 30, 75],
        "selfScores": [7, 5, 4, 6, 8, 5, 3, 7]  // опционально
    }
    """
    start_time = time.time()
    
    try:
        # Получаем данные
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Пустой запрос"}), 400

        print(f"\n{'='*70}")
        print(f"📨 НОВЫЙ ЗАПРОС")
        print(f"{'='*70}")
        print(f"👤 Пользователь: {data.get('userName', 'Аноним')} ({data.get('userEmail', 'no email')})")

        user_name = data.get("userName", "Пользователь")
        user_email = data.get("userEmail", "")
        test_scores = data.get("testScores", [])
        self_scores = data.get("selfScores", [])

        # Валидация теста
        if not test_scores or len(test_scores) != 8:
            return jsonify({
                "success": False,
                "error": "Некорректные данные теста: нужно 8 значений от 0 до 100"
            }), 400
        
        for score in test_scores:
            if not isinstance(score, (int, float)) or score < 0 or score > 100:
                return jsonify({
                    "success": False,
                    "error": "Значения теста должны быть числами от 0 до 100"
                }), 400

        # Валидация самооценки
        has_self = False
        if self_scores and len(self_scores) == 8:
            has_self = True
            for score in self_scores:
                if not isinstance(score, (int, float)) or score < 0 or score > 10:
                    return jsonify({
                        "success": False,
                        "error": "Значения самооценки должны быть числами от 0 до 10"
                    }), 400
            print(f"📊 Тест: {test_scores}")
            print(f"📈 Самооценка: {self_scores}")
            
            # Показываем разрывы
            print(f"\n📉 Разрывы:")
            for i in range(8):
                self_pct = round(self_scores[i] * 10)
                gap = test_scores[i] - self_pct
                gap_status = "переоценка" if gap < -20 else ("недооценка" if gap > 10 else "норма")
                print(f"  {AREA_NAMES[i]}: {gap:+.1f}% ({gap_status})")
        else:
            print(f"📊 Тест: {test_scores}")
            print(f"📈 Самооценка: не передана")

        # Проверяем API ключ
        if not QWEN_API_KEY:
            print("⚠️ QWEN_API_KEY не настроен, использую локальную генерацию")
            recommendations = generate_local_fallback(user_name, test_scores, self_scores if has_self else None)
            elapsed_time = time.time() - start_time
            return jsonify({
                "success": True,
                "recommendations": recommendations,
                "processing_time": elapsed_time,
                "used_fallback": True,
                "reason": "QWEN_API_KEY not configured"
            })

        # Строим промпт
        prompt = build_prompt(user_name, user_email, test_scores, self_scores if has_self else None)
        print(f"\n📝 Промпт создан (длина: {len(prompt)} символов)")
        print(f"🤖 Начинаю перебор {len(FREE_MODELS)} моделей...\n")

        # Перебираем модели
        recommendations = None
        used_model = None
        models_tried = []
        
        for model_id in FREE_MODELS:
            models_tried.append(model_id)
            recommendations = get_recommendations_from_model(model_id, prompt)
            if recommendations:
                used_model = model_id
                print(f"\n🎉 УСПЕХ! Модель {used_model} сгенерировала рекомендации")
                break
            print(f"   Модель {model_id} не ответила, пробую следующую...")

        # Если ни одна модель не ответила
        if not recommendations:
            print(f"\n❌ Все {len(FREE_MODELS)} модели недоступны, использую локальную генерацию")
            recommendations = generate_local_fallback(user_name, test_scores, self_scores if has_self else None)
            used_fallback = True
            reason = "All AI models failed"
        else:
            used_fallback = False
            reason = None

        # Логируем результат
        elapsed_time = time.time() - start_time
        print(f"\n{'='*70}")
        print(f"📊 ИТОГ:")
        print(f"  ✅ Рекомендации: {'получены от AI' if not used_fallback else 'локальная генерация'}")
        if used_model:
            print(f"  🤖 Модель: {used_model}")
        print(f"  ⏱️ Время: {elapsed_time:.2f} секунд")
        print(f"  📏 Длина: {len(recommendations)} символов")
        print(f"{'='*70}\n")

        # Отправляем ответ
        response_data = {
            "success": True,
            "recommendations": recommendations,
            "processing_time": elapsed_time,
            "used_fallback": used_fallback,
            "models_tried": models_tried
        }
        
        if used_model:
            response_data["used_model"] = used_model
        if reason:
            response_data["reason"] = reason
        
        return jsonify(response_data)

    except Exception as e:
        print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()
        
        # Пытаемся вернуть fallback даже при ошибке
        try:
            if 'test_scores' in locals() and test_scores:
                recommendations = generate_local_fallback(user_name, test_scores, self_scores if has_self else None)
                return jsonify({
                    "success": True,
                    "recommendations": recommendations,
                    "used_fallback": True,
                    "reason": f"Exception: {str(e)[:100]}"
                })
        except:
            pass
        
        return jsonify({
            "success": False,
            "error": f"Внутренняя ошибка сервера: {str(e)[:200]}"
        }), 500


# ========== ЗАПУСК ==========
if __name__ == "__main__":
    print(f"\n{'='*70}")
    print(f"🚀 CSM 2.0 RECOMMENDATIONS API")
    print(f"{'='*70}")
    print(f"✅ API ключ: {'настроен (' + QWEN_API_KEY[:10] + '...)' if QWEN_API_KEY else 'НЕ НАСТРОЕН'}")
    print(f"🤖 Модели в порядке приоритета:")
    for i, model in enumerate(FREE_MODELS, 1):
        print(f"   {i}. {model}")
    print(f"📚 Материалы: {'загружены' if load_materials() else 'НЕ ЗАГРУЖЕНЫ'}")
    print(f"{'='*70}\n")
    
    app.run(host="0.0.0.0", port=5000, debug=True)