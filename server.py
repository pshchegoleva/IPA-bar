import sqlite3
import random
import string
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DB_NAME = 'promocodes.db'

# ========== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ==========
def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Таблица пользователей и промокодов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vk_id TEXT UNIQUE NOT NULL,
            promo_code TEXT NOT NULL,
            received_at TEXT NOT NULL,
            activated_at TEXT,
            expires_at TEXT,
            акция TEXT DEFAULT 'default'
        )
    ''')
    
    # Таблица настроек акций
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            акция TEXT UNIQUE NOT NULL,
            active INTEGER DEFAULT 1,
            promo_text TEXT DEFAULT 'ПРОМОКОД'
        )
    ''')
    
    # Добавляем акцию по умолчанию
    cursor.execute('INSERT OR IGNORE INTO settings (акция, active, promo_text) VALUES (?, ?, ?)', 
                   ('default', 1, 'IPA-2025'))
    
    conn.commit()
    conn.close()

def generate_promo():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

# ========== API ЭНДПОИНТЫ ==========

@app.route('/get-promo', methods=['POST'])
def get_promo():
    data = request.json
    vk_id = data.get('vkId')
    акция = data.get('акция', 'default')
    
    if not vk_id:
        return jsonify({'success': False, 'message': 'Не передан VK ID'}), 400
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Проверяем, активна ли акция
    cursor.execute('SELECT active, promo_text FROM settings WHERE акция = ?', (акция,))
    setting = cursor.fetchone()
    
    if not setting or setting[0] == 0:
        conn.close()
        return jsonify({'success': False, 'message': 'Акция завершена или не активна'}), 400
    
    # Проверяем, получал ли уже пользователь промокод
    cursor.execute('SELECT promo_code, expires_at FROM users WHERE vk_id = ? AND акция = ?', (vk_id, акция))
    existing = cursor.fetchone()
    
    if existing:
        # Если промокод ещё активен по времени
        if existing[1] and datetime.fromisoformat(existing[1]) > datetime.now():
            conn.close()
            return jsonify({'success': False, 'message': f'У вас уже есть активный промокод: {existing[0]}'}), 400
        else:
            # Если промокод истёк, удаляем старую запись
            cursor.execute('DELETE FROM users WHERE vk_id = ? AND акция = ?', (vk_id, акция))
            conn.commit()
    
    # Генерируем новый промокод
    promo_code = generate_promo()
    expires_at = (datetime.now() + timedelta(minutes=15)).isoformat()
    
    cursor.execute('''
        INSERT INTO users (vk_id, promo_code, received_at, expires_at, акция)
        VALUES (?, ?, ?, ?, ?)
    ''', (vk_id, promo_code, datetime.now().isoformat(), expires_at, акция))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'promoCode': promo_code})

@app.route('/activate-promo', methods=['POST'])
def activate_promo():
    data = request.json
    vk_id = data.get('vkId')
    promo_code = data.get('promoCode')
    
    if not vk_id or not promo_code:
        return jsonify({'success': False, 'error': 'Не переданы данные'}), 400
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT expires_at FROM users 
        WHERE vk_id = ? AND promo_code = ? AND activated_at IS NULL
    ''', (vk_id, promo_code))
    
    result = cursor.fetchone()
    if not result:
        conn.close()
        return jsonify({'success': False, 'error': 'Промокод не найден или уже активирован'}), 400
    
    expires_at = datetime.fromisoformat(result[0])
    if expires_at < datetime.now():
        conn.close()
        return jsonify({'success': False, 'error': 'Время активации истекло'}), 400
    
    # Активируем промокод
    cursor.execute('''
        UPDATE users SET activated_at = ? 
        WHERE vk_id = ? AND promo_code = ?
    ''', (datetime.now().isoformat(), vk_id, promo_code))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Промокод активирован!'})

@app.route('/admin/settings', methods=['GET'])
def get_settings():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('SELECT акция, active, promo_text FROM settings')
    rows = cursor.fetchall()
    conn.close()
    return jsonify([
        {'акция': r[0], 'active': bool(r[1]), 'promo_text': r[2]} for r in rows
    ])

@app.route('/admin/settings', methods=['POST'])
def update_settings():
    data = request.json
    акция = data.get('акция')
    active = data.get('active')
    promo_text = data.get('promo_text')
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute('SELECT id FROM settings WHERE акция = ?', (акция,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
            UPDATE settings SET active = ?, promo_text = ? WHERE акция = ?
        ''', (1 if active else 0, promo_text, акция))
    else:
        cursor.execute('''
            INSERT INTO settings (акция, active, promo_text)
            VALUES (?, ?, ?)
        ''', (акция, 1 if active else 0, promo_text))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/admin/stats', methods=['GET'])
def get_stats():
    акция = request.args.get('акция', 'default')
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM users WHERE акция = ? AND activated_at IS NOT NULL', (акция,))
    activated = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(*) FROM users WHERE акция = ?', (акция,))
    total = cursor.fetchone()[0]
    conn.close()
    return jsonify({'total': total, 'activated': activated})

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)