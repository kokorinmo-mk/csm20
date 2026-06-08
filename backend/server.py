#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import os
import requests

app = Flask(__name__)
CORS(app)

# API-ключ OpenRouter — задаётся через переменную окружения на Render
QWEN_API_KEY = os.environ.get("QWEN_API_KEY", "")
QWEN_BASE_URL = "https://openrouter.ai/api/v1"

# Список бесплатных моделей — вызываются по очереди, пока одна не ответит
FREE_MODELS = [
    "nvidia/nemotron-3-super",
    "google/gemma-4-31b-it:free",
    "minimax/minimax-m2.5",
    "qwen/qwen3-8b:free",
    "mistralai/mistral-7b-instruct:free",
]

MATERIALS_URL = "https://script.google.com/macros/s/AKfycbzOlrBj4ZY5iqStx3gUiF3Duecu0W8X26BfFsvNWJ6CoRLU7Hf2B7jDHnLVX4qE9m9w/exec"


def get_client():
    return OpenAI(api_key=QWEN_API_KEY, base_url=QWEN_BASE_URL)


def load_materials():
    """Загружает материалы из Google Apps Script (JSON)"""
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


def get_recommendations_from_model(model_id, prompt):
    """Пытается получить ответ от указанной модели."""
    print(f"   Пробую модель: {model_id}...")
    try:
        client = get_client()
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=4000,
            timeout=90,
        )
        recommendations = response.choices[0].message.content
        print(f"   ✅ Модель {model_id} ответила успешно.")
        return recommendations
    except Exception as e:
        print(f"   ❌ Модель {model_id} не отвечает: {e}")
        return None


@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "ok", "message": "Сервер CSM 2.0 работает"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})


@app.route("/recommend", methods=["POST"])
def recommend():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Пустой запрос"}), 400

        print(f"📨 Запрос от: {data.get('userName')}")

        user_name = data.get("userName", "Пользователь")
        user_email = data.get("userEmail", "")
        test_scores = data.get("testScores", [])
        self_scores = data.get("selfScores", [])  # 8 значений 1–10 или пустой список

        if not test_scores or len(test_scores) != 8:
            return jsonify({"success": False, "error": "Некорректные данные теста: нужно 8 значений"}), 400

        if not QWEN_API_KEY:
            return jsonify({"success": False, "error": "QWEN_API_KEY не настроен на сервере"}), 500

        area_names = [
            "Осознание",
            "Стратегия",
            "Реинжиниринг",
            "Проектирование",
            "Внедрение",
            "Методология",
            "Отраслевые",
            "Soft skills",
        ]

        # Строим таблицу результатов
        has_self = len(self_scores) == 8
        scores_text = ""
        for i, name in enumerate(area_names):
            line = f"{name}: тест {test_scores[i]}%"
            if has_self:
                self_pct = round(self_scores[i] * 10)  # 1–10 → 10–100%
                gap = test_scores[i] - self_pct
                gap_str = f"+{gap}%" if gap >= 0 else f"{gap}%"
                line += f" | самооценка {self_scores[i]:.1f}/10 ({self_pct}%) | разрыв {gap_str}"
            scores_text += line + "\n"

        print(f"📊 Тест: {test_scores}")
        print(f"📊 Самооценка: {self_scores if has_self else 'не передана'}")

        materials_csv = load_materials()

        # Дополнительная инструкция по разрыву — только если есть самооценка
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
Результаты по областям:
{scores_text}

### ДОСТУПНЫЕ МАТЕРИАЛЫ:
{materials_csv}

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
"""

        print("🤖 Отправляю запросы к моделям...")
        recommendations = None
        for model in FREE_MODELS:
            recommendations = get_recommendations_from_model(model, prompt)
            if recommendations:
                break

        if not recommendations:
            print("❌ Ни одна модель не смогла ответить.")
            return jsonify({"success": False, "error": "Сервис временно недоступен. Попробуйте позже."}), 503

        print("✅ Рекомендации успешно получены.")
        return jsonify({"success": True, "recommendations": recommendations})

    except Exception as e:
        print(f"❌ Непредвиденная ошибка: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
