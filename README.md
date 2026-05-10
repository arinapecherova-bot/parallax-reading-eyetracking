# Parallax Reading Eye Tracking Study

## Авторы и участники

Основной участник - Арина А. Печерова, студентка ИКНК СПбПУ, группа 5130903/40003.

Научный руководитель - Александр В. Щукин, старший преподаватель ВШПИ СПбПУ.

## Введение

Экспериментальное исследование влияния параллакс-эффекта на качество прочтения текстового контента.

Проект реализован в ходе подготовки научно-исследовательской работы Арины А. Печеровой по дисциплине «Методы тестирования программного обеспечения» в Институте компьютерных наук и кибербезопасности СПбПУ (ИКНК СПбПУ).

В эксперименте сравнивались три версии веб-страницы с идентичным текстовым содержанием:
- **Версия A** (`ocean-parallax.html`) — полный параллакс-скроллинг
- **Версия B** (`ocean-static.html`) — статичная страница
- **Версия C** (`ocean-heading-parallax.html`) — параллакс только в заголовках разделов

Для сбора данных о движениях глаз применялась библиотека [WebGazer.js](https://webgazer.cs.brown.edu/).

## Структура репозитория

```
parallax-reading-eyetracking/
│
├── ocean-parallax.html          # Версия A: полный параллакс
├── ocean-static.html            # Версия B: статика 
├── ocean-heading-parallax.html  # Версия C: параллакс в заголовках
├── participant.html             # Страница участника (калибровка + чтение)
├── index.html                   # Главная страница стенда
│
├── script.js                    # Основной скрипт айтрекинга
├── style.css                    # Стили
├── webgazer.js                  # Библиотека WebGazer.js
├── face-api.min.js              # Библиотека определения лица
│
├── app.py                       # Flask-сервер для запуска стенда
├── analysis.py                  # Статистический анализ данных (Python)
├── extract.py                   # Извлечение и предобработка данных
├── synthetic_experiment.py      # Скрипт синтетического эксперимента
│
├── assets/                      # Изображения и медиафайлы
├── calibration/                 # Модуль калибровки айтрекера
├── data/                        # Данные эксперимента
│   ├── raw/                     # Сырые JSON-файлы сессий
│   └── results/                 # Обработанные данные (eyetracking_results.csv)
├── models/                      # Модели машинного обучения (WebGazer)
├── src/                         # Вспомогательный исходный код
├── tasks/                       # Задания для участников
└── tests/                       # Тесты
│
├── requirements.txt             # Зависимости Python
├── package.json                 # Зависимости Node.js
└── babel.config.js              # Конфигурация Babel
```

## Инструкция по запуску

### Требования

- Python 3.11
- Node.js 18+
- Браузер с доступом к веб-камере (рекомендуется Google Chrome)

### Установка зависимостей

```bash
# Python-зависимости
pip install -r requirements.txt

# Node.js-зависимости
npm install
```

### Запуск экспериментального стенда

```bash
python app.py
```

После запуска открыть в браузере: `https://localhost:5000`

### Порядок проведения эксперимента

1. Участник открывает `https://localhost:5000/participant`
2. Проходит калибровку айтрекера (9 точек)
3. Читает одну из трёх версий сайта (назначается случайно)
4. Переходит к анкете (Google Forms)

### Статистический анализ

```bash
python analysis.py
```

Результаты сохраняются в `data/results/eyetracking_results.csv`.

## Лицензия

MIT License

Входные наборы данных, используемые в этом репозитории, остаются под первоначальными лицензиями, указанными их соответствующими авторами и источниками, см. раздел «Ссылки».

## Гарантия

Разрабатываемое программное обеспечение находится в стадии разработки. Авторы не дают никаких гарантий.

## Ссылки

1. Rayner K. Eye movements in reading and information processing: 20 years of research // Psychological Bulletin. — 1998. — Vol. 124, No. 3. — P. 372–422.
2. Benedetto S. et al. Reading on a monitor: The effects of interface design on reading performance // Applied Ergonomics. — 2014. — Vol. 45, No. 3. — P. 714–721.
3. Papoutsaki A. et al. [WebGazer: Scalable Webcam Eye Tracking Using User Interactions](https://webgazer.cs.brown.edu/) // IJCAI. — 2016. — P. 3839–3845.
4. Kiefer P. et al. Eye Tracking for Research and as an Input Device // Geographical & Environmental Modelling. — 2017. — Vol. 21, No. 2. — P. 41–81.
