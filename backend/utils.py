#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
import json
import time
from functools import wraps
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

# Конфигурация
RATE_LIMIT_REQUESTS = 3  # количество запросов
RATE_LIMIT_WINDOW = 60   # окно в секундах
CACHE_TTL = 300          # время жизни кэша в секундах

# Хранилище для rate limiting
rate_limit_store: Dict[str, List[datetime]] = {}

# Кэш для материалов
materials_cache: Dict[str, Any] = {
    "data": "",
    "timestamp": 0
}


def rate_limit(f):
    """
    Декоратор для ограничения частоты запросов.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask import request, jsonify
        
        client_ip = request.remote_addr
        now = datetime.now()
        
        # Очищаем старые записи
        if client_ip in rate_limit_store:
            rate_limit_store[client_ip] = [
                req_time for req_time in rate_limit_store[client_ip]
                if now - req_time < timedelta(seconds=RATE_LIMIT_WINDOW)
            ]
        else:
            rate_limit_store[client_ip] = []
        
        # Проверяем лимит
        if len(rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
            return jsonify({
                "success": False,
                "error": f"Слишком много запросов. Подождите {RATE_LIMIT_WINDOW} секунд."
            }), 429
        
        # Добавляем текущий запрос
        rate_limit_store[client_ip].append(now)
        
        return f(*args, **kwargs)
    
    return decorated_function


def cache_result(ttl: int = CACHE_TTL):
    """
    Декоратор для кэширования результатов функции.
    """
    def decorator(f):
        cache = {
            "data": None,
            "timestamp": 0
        }
        
        @wraps(f)
        def decorated_function(*args, **kwargs):
            current_time = time.time()
            
            # Проверяем кэш
            if cache["data"] and (current_time - cache["timestamp"] < ttl):
                return cache["data"]
            
            # Выполняем функцию
            result = f(*args, **kwargs)
            
            # Сохраняем в кэш
            cache["data"] = result
            cache["timestamp"] = current_time
            
            return result
        
        return decorated_function
    
    return decorator


def validate_test_scores(scores: List[int]) -> bool:
    """
    Проверяет валидность результатов теста.
    
    Args:
        scores: Список из 8 чисел (0-100)
    
    Returns:
        True если валидны, False иначе
    """
    if not scores or len(scores) != 8:
        return False
    
    for score in scores:
        if not isinstance(score, (int, float)) or score < 0 or score > 100:
            return False
    
    return True


def validate_self_scores(scores: List[float]) -> bool:
    """
    Проверяет валидность результатов самооценки.
    
    Args:
        scores: Список из 8 чисел (0-10)
    
    Returns:
        True если валидны, False иначе
    """
    if not scores or len(scores) != 8:
        return False
    
    for score in scores:
        if not isinstance(score, (int, float)) or score < 0 or score > 10:
            return False
    
    return True


def calculate_gap(test_score: float, self_score: float) -> float:
    """
    Рассчитывает разрыв между тестом и самооценкой.
    
    Args:
        test_score: Результат теста (0-100)
        self_score: Результат самооценки (0-10, преобразуется в 0-100)
    
    Returns:
        Разрыв в процентах (положительный = тест выше самооценки)
    """
    self_score_normalized = self_score * 10
    return test_score - self_score_normalized


def get_difficulty_level(gap: float) -> str:
    """
    Определяет уровень сложности материалов на основе разрыва.
    
    Args:
        gap: Разрыв между тестом и самооценкой
    
    Returns:
        'basic', 'medium' или 'advanced'
    """
    if gap < -20:
        return "basic"
    elif gap > 10:
        return "advanced"
    else:
        return "medium"


def sanitize_phone(phone: str) -> str:
    """
    Очищает номер телефона от лишних символов.
    
    Args:
        phone: Строка с номером телефона
    
    Returns:
        Очищенный номер телефона
    """
    if not phone:
        return ""
    
    # Удаляем все кроме цифр и плюса
    cleaned = re.sub(r'[^\d+]', '', phone)
    
    return cleaned


def is_valid_email(email: str) -> bool:
    """
    Проверяет валидность email адреса.
    
    Args:
        email: Строка с email
    
    Returns:
        True если валидный, False иначе
    """
    if not email:
        return False
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def format_error_response(error_message: str, status_code: int = 400) -> tuple:
    """
    Форматирует ответ с ошибкой.
    
    Args:
        error_message: Текст ошибки
        status_code: HTTP статус код
    
    Returns:
        Кортеж (response, status_code)
    """
    from flask import jsonify
    
    return jsonify({
        "success": False,
        "error": error_message,
        "timestamp": datetime.now().isoformat()
    }), status_code


def format_success_response(data: Any, message: str = "") -> tuple:
    """
    Форматирует успешный ответ.
    
    Args:
        data: Данные для отправки
        message: Дополнительное сообщение
    
    Returns:
        Кортеж (response, status_code)
    """
    from flask import jsonify
    
    response = {
        "success": True,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }
    
    if message:
        response["message"] = message
    
    return jsonify(response), 200


def log_request(user_name: str, user_email: str, test_scores: List[int], self_scores: List[float] = None):
    """
    Логирует входящий запрос.
    
    Args:
        user_name: Имя пользователя
        user_email: Email пользователя
        test_scores: Результаты теста
        self_scores: Результаты самооценки (опционально)
    """
    print(f"\n{'='*60}")
    print(f"📨 НОВЫЙ ЗАПРОС")
    print(f"{'='*60}")
    print(f"👤 Пользователь: {user_name} ({user_email})")
    print(f"📊 Тест: {test_scores}")
    
    if self_scores:
        print(f"📈 Самооценка: {self_scores}")
        
        # Показываем разрывы
        print(f"\n📉 Разрывы:")
        area_names = [
            "Осознание", "Стратегия", "Реинжиниринг", "Проектирование",
            "Внедрение", "Методология", "Отраслевые", "Soft skills"
        ]
        
        for i in range(8):
            gap = calculate_gap(test_scores[i], self_scores[i])
            print(f"  {area_names[i]}: {gap:+.1f}% ({get_difficulty_level(gap)})")
    
    print(f"{'='*60}\n")


def get_model_fallback_order() -> List[str]:
    """
    Возвращает порядок моделей для fallback.
    
    Returns:
        Список ID моделей
    """
    return [
        "nvidia/nemotron-3-super",
        "google/gemma-4-31b-it:free",
        "minimax/minimax-m2.5",
        "qwen/qwen3-8b:free",
        "mistralai/mistral-7b-instruct:free",
    ]


def clean_markdown(text: str) -> str:
    """
    Очищает markdown от потенциально опасных элементов.
    
    Args:
        text: Текст с markdown разметкой
    
    Returns:
        Очищенный текст
    """
    if not text:
        return ""
    
    # Удаляем HTML теги
    text = re.sub(r'<[^>]+>', '', text)
    
    # Экранируем специальные символы
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    text = text.replace("'", '&#39;')
    
    return text


def extract_urls(text: str) -> List[str]:
    """
    Извлекает все URL из текста.
    
    Args:
        text: Текст с URL
    
    Returns:
        Список URL
    """
    if not text:
        return []
    
    pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
    return re.findall(pattern, text)


def is_valid_url(url: str) -> bool:
    """
    Проверяет валидность URL.
    
    Args:
        url: Строка URL
    
    Returns:
        True если валидный, False иначе
    """
    if not url:
        return False
    
    pattern = r'^https?://[^\s<>"{}|\\^`\[\]]+$'
    return bool(re.match(pattern, url))


def truncate_text(text: str, max_length: int = 4000) -> str:
    """
    Обрезает текст до максимальной длины.
    
    Args:
        text: Исходный текст
        max_length: Максимальная длина
    
    Returns:
        Обрезанный текст
    """
    if not text or len(text) <= max_length:
        return text
    
    # Обрезаем по словам
    truncated = text[:max_length]
    last_space = truncated.rfind(' ')
    
    if last_space > 0:
        truncated = truncated[:last_space]
    
    return truncated + "..."
