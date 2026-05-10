"""
extract.py — скрипт для извлечения метрик айтрекинга из JSON-файлов эксперимента.

Запуск:
    python3 extract.py

Результат:
    - Таблица в консоли
    - Файл data/results/eyetracking_results.csv  (копируй в Excel)
"""

import os
import json
import csv
import numpy as np
from datetime import datetime


# ─── Алгоритмы (дублируем здесь, чтобы скрипт работал автономно) ──────────────

def count_regressions(gaze_data, min_leftward_px=30):
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
    fixations = []
    cur = 0
    if not gaze_data:
        return {'avg_fixation_duration': 0}
    for i in range(len(gaze_data)):
        w = gaze_data[cur: i + 1]
        disp = max(
            max(p.get('x', 0) for p in w) - min(p.get('x', 0) for p in w),
            max(p.get('y', 0) for p in w) - min(p.get('y', 0) for p in w)
        )
        dur = w[-1].get('timestamp', 0) - w[0].get('timestamp', 0)
        if disp > dispersion_threshold:
            prev = gaze_data[cur:i]
            if prev:
                pd_ = prev[-1].get('timestamp', 0) - prev[0].get('timestamp', 0)
                if pd_ >= duration_threshold_ms:
                    fixations.append(prev)
            cur = i
        elif i == len(gaze_data) - 1 and dur >= duration_threshold_ms:
            fixations.append(w)
    avg = (np.mean([f[-1].get('timestamp', 0) - f[0].get('timestamp', 0) for f in fixations])
           if fixations else 0)
    return {'avg_fixation_duration': float(avg)}


def compute_dispersion(gaze_data):
    if not gaze_data:
        return 0
    xs = [p.get('x', 0) for p in gaze_data]
    ys = [p.get('y', 0) for p in gaze_data]
    return (np.std(xs) + np.std(ys)) / 2


def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    gaze = data.get('gazeData', [])
    tasks = [t for t in data.get('tasks', []) if t.get('completed')]

    reg = count_regressions(gaze)
    fix = detect_fixations(gaze)
    disp = compute_dispersion(gaze)
    time_s = sum(t.get('duration', 0) for t in tasks) / 1000

    return {
        'ID': data.get('participantNumber', os.path.basename(filepath)[:5]),
        'Группа': 'Параллакс' if data.get('group') == 'A' else ('Заголовки' if data.get('group') == 'C' else 'Статика'),
        'Регрессии_шт': reg,
        'Фиксации_мс': round(fix['avg_fixation_duration']),
        'Дисперсия_пкс': round(disp),
        'Время_с': round(time_s),
        'Gaze_точек': len(gaze),
        'Калибровка': data.get('calibrationAccuracy', '—'),
        'Файл': os.path.basename(filepath),
    }


# ─── Главная логика ─────────────────────────────────────────────────────────────

FOLDER = 'data/experiments'
OUTPUT = 'data/results/eyetracking_results.csv'

os.makedirs('data/results', exist_ok=True)

files = sorted([f for f in os.listdir(FOLDER) if f.endswith('.json')])
if not files:
    print(f'⚠️  В папке {FOLDER} нет JSON-файлов.')
    print('   Сначала проведите хотя бы один эксперимент.')
    exit()

rows = []
errors = []

print(f'\nОбрабатываю {len(files)} файлов из {FOLDER}/\n')

for fname in files:
    try:
        row = process_file(os.path.join(FOLDER, fname))
        rows.append(row)
        print(f"  ✅ {row['ID']:6s} | {row['Группа']:10s} | "
              f"Регр={row['Регрессии_шт']:3d} | "
              f"Фикс={row['Фиксации_мс']:4d} мс | "
              f"Дисп={row['Дисперсия_пкс']:4d} пкс | "
              f"Время={row['Время_с']:4d} с | "
              f"Points={row['Gaze_точек']}")
    except Exception as e:
        errors.append(fname)
        print(f"  ❌ {fname}: {e}")

if not rows:
    print('\nНет корректных данных.')
    exit()

# ─── Сводная статистика ──────────────────────────────────────────────────────────
para = [r for r in rows if r['Группа'] == 'Параллакс']
stat = [r for r in rows if r['Группа'] == 'Статика']

print('\n' + '='*70)
print(f'  ИТОГО: {len(rows)} сессий | Параллакс: {len(para)} | Статика: {len(stat)}')
print('='*70)

def avg(lst, key):
    vals = [r[key] for r in lst if r[key] is not None and r[key] != 0]
    return round(np.mean(vals), 1) if vals else '—'

metrics_cols = ['Регрессии_шт', 'Фиксации_мс', 'Дисперсия_пкс', 'Время_с']
labels = ['Регрессии, шт', 'Фиксации, мс', 'Дисперсия, пкс', 'Время, с']

print(f"\n{'Метрика':<22} {'Параллакс':>12} {'Статика':>12} {'Разница':>12}")
print('-' * 60)
for col, lbl in zip(metrics_cols, labels):
    a = avg(para, col)
    b = avg(stat, col)
    diff = f"+{round(float(a)-float(b),1)}" if (a != '—' and b != '—') else '—'
    print(f"  {lbl:<20} {str(a):>12} {str(b):>12} {diff:>12}")

print('='*70)



# ─── Экспорт в CSV ───────────────────────────────────────────────────────────────
fieldnames = ['ID', 'Группа', 'Регрессии_шт', 'Фиксации_мс',
              'Дисперсия_пкс', 'Время_с', 'Gaze_точек', 'Калибровка', 'Файл']

with open(OUTPUT, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f'\n📄 CSV сохранён: {OUTPUT}')
print('')

if errors:
    print(f'⚠️  Ошибки при чтении файлов: {errors}\n')
