#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import os
import requests

app = Flask(__name__)
CORS(app)

QWEN_API_KEY = os.environ.get("QWEN_API_KEY")
if not QWEN_API_KEY:
    QWEN_API_KEY = "ВАШ_API_КЛЮЧ_OPENROUTER"

QWEN_BASE_URL = "https://openrouter.ai/api/v1"

FREE_MODELS = [
    "nvidia/nemotron-3-super",
    "google/gemma-4-31b-it:free",
    "minimax/minimax-m2.5",
    "qwen/qwen3-8b:free",
    "mistralai/mistral-7b-instruct:free",
]

MATERIALS_URL = "https://script.google.com/macros/s/AKfycbzOlrBj4ZY5iqStx3gUiF3Duecu0W8X26BfFsvNWJ6CoRLU7Hf2B7jDHnLVX4qE9m9w/exec"

AREA_NAMES = ["Осознание", "Стратегия", "Реинжиниринг", "Проектирование", "Внедрение", "Методология", "Отраслевые", "Soft skills"]


def get_client():
    """Создает клиент OpenAI внутри функции, чтобы избежать проблем с прокси"""
    return OpenAI(
        api_key=QWEN_API_KEY,
        base_url=QWEN_BASE_URL,
    )


def load_materials():
    try:
        response = requests.get(MATERIALS_URL, timeout=30)
        data = response.json()
        result = []
        for area, items in data.items():
            result.append(f"\n### {area}")
            for item in items[:5]:
                result.append(f"{item['name']} | {item['url']}")
        print(f"✅ Загружено материалов: {len(result)}")
        return "\n".join(result)
    except Exception as e:
        print(f"❌ Ошибка загрузки материалов: {e}")
        return ""


def parse_scores(scores_list, is_test=True):
    result = []
    for i, name in enumerate(AREA_NAMES):
        if i < len(scores_list):
            value = scores_list[i]
            if is_test:
                result.append(f"{name}: {value}%")
            else:
                result.append(f"{name}: {value}/10")
    return "\n".join(result)


def extract_first_name(full_name):
    if not full_name:
        return "Пользователь"
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return parts[1]
    return parts[0]


def get_recommendations_from_model(model_id, prompt):
    print(f"   Пробую модель: {model_id}...")
    try:
        client = get_client()  # Клиент создается здесь
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=4000,
            timeout=90
        )
        recommendations = response.choices[0].message.content
        print(f"   ✅ Модель {model_id} ответила успешно.")
        return recommendations
    except Exception as e:
        print(f"   ❌ Модель {model_id} не отвечает: {e}")
        return None


@app.route('/', methods=['GET'])
def index():
    return jsonify({"status": "ok", "message": "Сервер CSM 2.0 работает"})


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "has_api_key": bool(QWEN_API_KEY and QWEN_API_KEY != "ВАШ_API_КЛЮЧ_OPENROUTER"),
        "models_available": len(FREE_MODELS)
    })


@app.route('/recommend', methods=['POST', 'OPTIONS'])
def recommend():
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        print(f"📨 Запрос от: {data.get('userName') if data else 'None'}")

        if not data:
            return jsonify({"success": False, "error": "Нет данных"}), 400

        user_name = data.get('userName', 'Пользователь')
        user_email = data.get('userEmail', '')
        test_scores = data.get('testScores', [])
        self_scores = data.get('selfScores', [])

        # Валидация testScores
        if not test_scores or len(test_scores) != 8:
            return jsonify({"success": False, "error": f"Некорректные данные теста: получено {len(test_scores)} областей, ожидается 8"}), 400

        # selfScores НЕ ОБЯЗАТЕЛЬНЫ
        if not self_scores or len(self_scores) != 8:
            print("⚠️ selfScores не переданы, использую значения по умолчанию")
            self_scores = [5, 5, 5, 5, 5, 5, 5, 5]

        print(f"📊 Тест: {test_scores}")
        print(f"📈 Самооценка: {self_scores}")

        scores_text = parse_scores(test_scores, is_test=True)
        self_scores_text = parse_scores(self_scores, is_test=False)
        first_name = extract_first_name(user_name)
        materials_text = load_materials()

        prompt = f"""Ты — эксперт по компетенциям CSM 2.0.

### ВХОДНЫЕ ДАННЫЕ:
- Имя пользователя: {first_name}
- Почта пользователя: {user_email}
- Результаты теста:
{scores_text}
- Результаты самооценки:
{self_scores_text}
- Материалы для рекомендаций:
{materials_text}

### АЛГОРИТМ:
1. Найди области с результатом теста < 100%
2. Отсортируй их по возрастанию (худшие первые)
3. Возьми первые 3 области (или меньше)
4. Для каждой области выбери 3 курса, 3 статьи, 3 видео из списка материалов
5. Рассчитай расхождение: самооценка% = (self_score/10)×100, расхождение = тест - самооценка%

### ВЫХОДНЫЕ ДАННЫЕ:

{first_name}, ваши результаты теста CSM 2.0:

**[Название области]**
📊 Результат теста: X%
📝 Самооценка: X/10
⚖️ Расхождение: X% (тип: завышена/занижена/адекватна)
📚 Рекомендуем изучить:
**[Курсы]**
• [Название](ссылка)
**[Статьи]**
• [Название](ссылка)
**[Видео]**
• [Название](ссылка)

### ПРАВИЛА:
- Только русский язык
- Ссылки ТОЛЬКО из списка материалов выше
- Формат ссылок строго: [Название](URL)
- Никаких советов и выводов после блоков
- Ровно 3 области (если есть)"""

        if not QWEN_API_KEY or QWEN_API_KEY == "ВАШ_API_КЛЮЧ_OPENROUTER":
            return jsonify({"success": False, "error": "QWEN_API_KEY не настроен"}), 500

        print("🤖 Отправляю запросы к моделям...")
        recommendations = None
        for model in FREE_MODELS:
            recommendations = get_recommendations_from_model(model, prompt)
            if recommendations:
                break

        if not recommendations:
            return jsonify({"success": False, "error": "Сервис временно недоступен"}), 503

        print("✅ Рекомендации успешно получены.")
        return jsonify({"success": True, "recommendations": recommendations})

    except Exception as e:
        print(f"❌ Непредвиденная ошибка: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)