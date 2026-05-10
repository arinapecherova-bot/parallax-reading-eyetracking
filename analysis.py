import numpy as np
import pandas as pd
import os
import json
import csv
from datetime import datetime


# ─────────────────────────────────────────────
#  БАЗОВЫЕ ФУНКЦИИ ОБРАБОТКИ GAZE-ДАННЫХ
# ─────────────────────────────────────────────

def count_regressions(gaze_data, min_leftward_px=30):
    """
    Считает регрессии — моменты, когда взгляд резко прыгает ВЛЕВО.
    При чтении слева направо X координата растёт.
    Если X уменьшился на > min_leftward_px пикселей — это регрессия (возврат назад).
    
    Порог 30 пикселей отсекает естественное дрожание глаз (тремор ~5–15 пкс).
    Источник нормы: Rayner K. (1998). Psychological Bulletin, 124(3), 372–422.
    """
    if len(gaze_data) < 2:
        return 0
    regressions = 0
    for i in range(1, len(gaze_data)):
        prev_x = gaze_data[i - 1].get('x', 0)
        curr_x = gaze_data[i].get('x', 0)
        if (prev_x - curr_x) > min_leftward_px:
            regressions += 1
    return regressions


def detect_fixations(gaze_data, dispersion_threshold=50, duration_threshold_ms=100):
    """
    Определяет фиксации взгляда (моменты покоя между саккадами).
    
    Алгоритм: dispersion-based (I-DT).
    Если разброс точек в скользящем окне <= 50 пкс — это фиксация.
    Возвращает: число фиксаций, среднюю длительность (мс), дисперсию по X и Y.
    
    Источник: Salvucci & Goldberg (2000). Identifying fixations and saccades
    in eye-tracking protocols. ETRA 2000.
    """
    fixations = []
    current_fixation_start_index = 0

    if not gaze_data:
        return {
            'num_fixations': 0,
            'avg_fixation_duration': 0,
            'gaze_dispersion_x': 0,
            'gaze_dispersion_y': 0
        }

    for i in range(len(gaze_data)):
        window_points = gaze_data[current_fixation_start_index: i + 1]
        if not window_points:
            continue

        min_x = min(p.get('x', 0) for p in window_points)
        max_x = max(p.get('x', 0) for p in window_points)
        min_y = min(p.get('y', 0) for p in window_points)
        max_y = max(p.get('y', 0) for p in window_points)

        total_dispersion = max(max_x - min_x, max_y - min_y)
        start_time = window_points[0].get('timestamp', 0)
        end_time = window_points[-1].get('timestamp', 0)
        duration = end_time - start_time

        if total_dispersion > dispersion_threshold:
            potential = gaze_data[current_fixation_start_index: i]
            if potential:
                pot_dur = potential[-1].get('timestamp', 0) - potential[0].get('timestamp', 0)
                if pot_dur >= duration_threshold_ms:
                    fixations.append(potential)
            current_fixation_start_index = i
        elif i == len(gaze_data) - 1 and duration >= duration_threshold_ms:
            fixations.append(window_points)

    num_fixations = len(fixations)
    avg_fixation_duration = (
        np.mean([f[-1].get('timestamp', 0) - f[0].get('timestamp', 0) for f in fixations])
        if fixations else 0
    )

    if gaze_data:
        all_x = [p.get('x', 0) for p in gaze_data]
        all_y = [p.get('y', 0) for p in gaze_data]
        gaze_dispersion_x = float(np.std(all_x)) if len(all_x) > 1 else 0
        gaze_dispersion_y = float(np.std(all_y)) if len(all_y) > 1 else 0
    else:
        gaze_dispersion_x = gaze_dispersion_y = 0

    return {
        'num_fixations': num_fixations,
        'avg_fixation_duration': float(avg_fixation_duration),
        'gaze_dispersion_x': gaze_dispersion_x,
        'gaze_dispersion_y': gaze_dispersion_y
    }


def compute_gaze_dispersion(gaze_data):
    """
    Возвращает дисперсию взгляда в пикселях как среднее std по X и Y.
    Именно это число используется в таблице данных тезиса.
    """
    if not gaze_data:
        return 0
    all_x = [p.get('x', 0) for p in gaze_data]
    all_y = [p.get('y', 0) for p in gaze_data]
    return (np.std(all_x) + np.std(all_y)) / 2


# ─────────────────────────────────────────────
#  ОСНОВНАЯ ФУНКЦИЯ ИЗВЛЕЧЕНИЯ МЕТРИК ИЗ JSON
# ─────────────────────────────────────────────

def extract_metrics(data):
    """
    Принимает словарь данных одной сессии (из JSON-файла).
    Возвращает все метрики, нужные для таблицы тезиса.
    """
    gaze_data = data.get('gazeData', [])
    tasks = data.get('tasks', [])
    completed_tasks = [t for t in tasks if t.get('completed')]

    # Время на странице (сумма всех завершённых задач, мс → секунды)
    task_time_s = sum(t.get('duration', 0) for t in completed_tasks) / 1000

    # Айтрекинг
    fix = detect_fixations(gaze_data)
    reg = count_regressions(gaze_data, min_leftward_px=30)
    disp = compute_gaze_dispersion(gaze_data)

    # Участник и группа
    participant = data.get('participantNumber', '?')
    group = data.get('group', '?')

    return {
        'ID': participant,
        'Группа': 'Параллакс' if group == 'A' else ('Заголовки' if group == 'C' else 'Статика'),
        'Регрессии_шт': reg,
        'Фиксации_мс': round(fix['avg_fixation_duration']),
        'Дисперсия_пкс': round(disp),
        'Время_с': round(task_time_s),
        # Дополнительные поля
        'sessionId': data.get('sessionId', ''),
        'gazePoints': len(gaze_data),
        'calibrationAccuracy': data.get('calibrationAccuracy'),
    }


# ─────────────────────────────────────────────
#  ПАКЕТНЫЙ АНАЛИЗ: читаем все JSON из папки
# ─────────────────────────────────────────────

class ITEAnalyzer:
    def __init__(self, experiments_folder='data/experiments'):
        self.experiments_folder = experiments_folder

    def load_all_sessions(self):
        records = []
        folder = self.experiments_folder
        if not os.path.exists(folder):
            return pd.DataFrame()

        for fname in os.listdir(folder):
            if not fname.endswith('.json'):
                continue
            try:
                with open(os.path.join(folder, fname), 'r', encoding='utf-8') as f:
                    data = json.load(f)
                metrics = extract_metrics(data)
                records.append(metrics)
            except Exception as e:
                print(f'Ошибка при чтении {fname}: {e}')

        return pd.DataFrame(records)

    def analyze_experiment(self, experiment_data=None):
        """
        Анализирует все сессии из папки и возвращает итоговую статистику.
        Если передан experiment_data — добавляет его к анализу.
        """
        df = self.load_all_sessions()

        if experiment_data:
            new_row = extract_metrics(experiment_data)
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

        if df.empty:
            return {'error': 'Нет данных для анализа'}

        return self._compute_stats(df)

    def _compute_stats(self, df):
        """Считает описательную статистику по двум группам."""
        para = df[df['Группа'] == 'Параллакс']
        stat = df[df['Группа'] == 'Статика']
        head = df[df['Группа'] == 'Заголовки']

        result = {
            'n_parallax': len(para),
            'n_static': len(stat),
            'n_headings': len(head), 
            'metrics': {}
        }

        for col in ['Регрессии_шт', 'Фиксации_мс', 'Дисперсия_пкс', 'Время_с']:
            if col not in df.columns:
                continue
            a_vals = para[col].dropna().tolist()
            b_vals = stat[col].dropna().tolist()
            result['metrics'][col] = {
                'mean_A': round(float(np.mean(a_vals)), 2) if a_vals else None,
                'mean_B': round(float(np.mean(b_vals)), 2) if b_vals else None,
                'sd_A': round(float(np.std(a_vals, ddof=1)), 2) if len(a_vals) > 1 else None,
                'sd_B': round(float(np.std(b_vals, ddof=1)), 2) if len(b_vals) > 1 else None,
            }

        result['individual'] = df[[
            'ID', 'Группа', 'Регрессии_шт', 'Фиксации_мс',
            'Дисперсия_пкс', 'Время_с', 'gazePoints'
        ]].to_dict(orient='records')

        return result

    def export_csv(self, output_path='data/results/eyetracking_results.csv'):
        """Экспортирует все метрики айтрекинга в CSV-файл."""
        df = self.load_all_sessions()
        if df.empty:
            print('Нет данных для экспорта.')
            return None
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        print(f'Экспортировано {len(df)} записей → {output_path}')
        return output_path

    # Старые методы оставлены для совместимости
    def analyze_two_sessions(self, chrome_data, firefox_data):
        return {'note': 'Используйте analyze_experiment() для анализа по группам'}

    def analyze_experiment_list(self, experiment_list):
        records = [extract_metrics(d) for d in experiment_list]
        df = pd.DataFrame(records)
        return self._compute_stats(df)

    def _extract_metrics(self, data):
        return extract_metrics(data)
