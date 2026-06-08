# CSM 2.0 — Система оценки компетенций

Веб-приложение для оценки компетенций по программе CSM 2.0: тестирование, самооценка и персональные рекомендации на основе AI.

## Структура репозитория

```
csm20/
├── frontend/
│   └── index.html        # Одностраничное приложение (Firebase Auth + Firestore)
├── backend/
│   ├── server.py         # Flask-сервер, генерирует рекомендации через OpenRouter
│   └── requirements.txt  # Python-зависимости
├── render.yaml           # Конфиг деплоя на Render.com
└── .gitignore
```

## Стек

| Часть | Технологии |
|---|---|
| Фронтенд | Vanilla JS, Firebase Auth, Firestore |
| Хостинг фронтенда | Netlify (`csm20-web.netlify.app`) |
| Бэкенд | Python, Flask, OpenRouter API |
| Хостинг бэкенда | Render.com |
| AI-модели | OpenRouter (бесплатные: Gemma, Qwen, Mistral и др.) |
| Данные | Google Sheets (материалы и вопросы теста) |

## Деплой бэкенда на Render

1. Создай новый **Web Service** на [render.com](https://render.com)
2. Подключи этот репозиторий
3. Render автоматически подхватит `render.yaml`
4. В разделе **Environment** добавь переменную:
   - `QWEN_API_KEY` — ключ от [openrouter.ai](https://openrouter.ai)

## Деплой фронтенда на Netlify

1. Подключи репозиторий на [netlify.com](https://netlify.com)
2. **Base directory:** `frontend`
3. **Publish directory:** `frontend`
4. Build command: *(оставь пустым)*

## Локальный запуск бэкенда

```bash
cd backend
pip install -r requirements.txt
export QWEN_API_KEY=your_key_here
python server.py
```

Сервер запустится на `http://localhost:5000`

## Переменные окружения

| Переменная | Где задать | Описание |
|---|---|---|
| `QWEN_API_KEY` | Render Dashboard | API-ключ OpenRouter |

## API

### `POST /recommend`

**Тело запроса:**
```json
{
  "userName": "Иван Иванов",
  "userEmail": "ivan@example.com",
  "testScores": [80, 60, 40, 70, 90, 50, 30, 75]
}
```
`testScores` — массив из 8 чисел (% по каждой области), порядок: Осознание, Стратегия, Реинжиниринг, Проектирование, Внедрение, Методология, Отраслевые, Soft skills.

**Ответ:**
```json
{
  "success": true,
  "recommendations": "Иван, ваши результаты теста CSM 2.0:\n\n**Отраслевые**\n📊 Результат: 30%\n..."
}
```
