from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import uuid
from datetime import datetime
from analysis import ITEAnalyzer, extract_metrics

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'data/experiments'
RESULTS_FOLDER = 'data/results'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['RESULTS_FOLDER'] = RESULTS_FOLDER

analyzer = ITEAnalyzer(UPLOAD_FOLDER)


# ─── Статика ───────────────────────────────────────────────────────────────────

@app.route('/')
def root():
    return send_from_directory(os.getcwd(), 'participant.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(os.getcwd(), filename)


# ─── Сохранение данных эксперимента ────────────────────────────────────────────

@app.route('/api/upload', methods=['POST'])
def upload_experiment_data():
    """
    Принимает JSON с данными сессии от фронтенда и сохраняет в data/experiments/.
    Сразу же считает метрики и возвращает их клиенту.
    """
    try:
        body = request.get_json()
        if not body or 'experimentData' not in body:
            return jsonify({'error': 'No experimentData in request'}), 400

        data = body['experimentData']
        session_id = data.get('sessionId', str(uuid.uuid4()))
        participant = data.get('participantNumber', 'unknown')
        group = data.get('group', '?')

        # Сохраняем сырой JSON
        filename = f"{participant}_{group}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Сразу считаем метрики
        metrics = extract_metrics(data)

        print(f"\n✅ Сохранена сессия: {filename}")
        print(f"   Участник: {participant} | Группа: {group}")
        print(f"   Регрессии:  {metrics['Регрессии_шт']} шт.")
        print(f"   Фиксации:   {metrics['Фиксации_мс']} мс")
        print(f"   Дисперсия:  {metrics['Дисперсия_пкс']} пкс")
        print(f"   Время:      {metrics['Время_с']} с")
        print(f"   Gaze-точек: {metrics['gazePoints']}")

        return jsonify({
            'status': 'success',
            'session_id': session_id,
            'filename': filename,
            'metrics': metrics,
            'message': 'Данные сохранены успешно'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Получение результатов по всем сессиям ─────────────────────────────────────

@app.route('/api/results', methods=['GET'])
def get_all_results():
    """
    Возвращает метрики по ВСЕМ сохранённым сессиям + сводную статистику по группам.
    Открыть в браузере: http://localhost:5000/api/results
    """
    try:
        result = analyzer.analyze_experiment()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/export', methods=['GET'])
def export_csv():
    """
    Экспортирует все метрики в CSV-файл data/results/eyetracking_results.csv.
    Открыть в браузере: http://localhost:5000/api/export
    """
    try:
        path = analyzer.export_csv()
        if path:
            return jsonify({'status': 'success', 'file': path,
                            'message': f'Файл сохранён: {path}'}), 200
        return jsonify({'status': 'empty', 'message': 'Нет данных для экспорта'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/experiments', methods=['GET'])
def list_experiments():
    """Список всех сохранённых файлов экспериментов."""
    try:
        files = [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith('.json')]
        experiments = []
        for fname in sorted(files):
            fpath = os.path.join(UPLOAD_FOLDER, fname)
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            m = extract_metrics(data)
            experiments.append({
                'file': fname,
                'participantNumber': data.get('participantNumber'),
                'group': data.get('group'),
                'timestamp': data.get('timestamp'),
                'metrics': {
                    'regressions': m['Регрессии_шт'],
                    'fixation_ms': m['Фиксации_мс'],
                    'dispersion_px': m['Дисперсия_пкс'],
                    'time_s': m['Время_с'],
                    'gaze_points': m['gazePoints'],
                }
            })
        return jsonify({'status': 'success', 'count': len(experiments),
                        'experiments': experiments}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("\n" + "="*55)
    print("  UX Эксперимент — сервер запущен")
    print("="*55)
    print("  Участник открывает:  http://localhost:5000/participant.html")
    print("  Список сессий:       http://localhost:5000/api/experiments")
    print("  Результаты:          http://localhost:5000/api/results")
    print("  Экспорт CSV:         http://localhost:5000/api/export")
    print("="*55 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
