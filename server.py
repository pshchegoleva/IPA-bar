import os
import secrets
import random
import hashlib
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
import qrcode
import io
import base64

load_dotenv()

app = Flask(__name__)

CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Подключение к БД: для PostgreSQL используем драйвер psycopg (v3)
db_url = os.getenv('DATABASE_URL', 'sqlite:///test.db')
if db_url.startswith('postgresql://'):
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret')



db = SQLAlchemy(app)

# ===========================================================
# МОДЕЛИ
# ===========================================================

class Bar(db.Model):
    __tablename__ = 'bars'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    address = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    vk_id = db.Column(db.String(100), unique=True, nullable=False)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    avatar_url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class StaffUser(db.Model):
    __tablename__ = 'staff_users'
    id = db.Column(db.Integer, primary_key=True)
    bar_id = db.Column(db.Integer, db.ForeignKey('bars.id'), nullable=False)
    login = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100))
    role = db.Column(db.String(20), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Promotion(db.Model):
    __tablename__ = 'promotions'
    id = db.Column(db.Integer, primary_key=True)
    bar_id = db.Column(db.Integer, db.ForeignKey('bars.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    gift_name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    code_word = db.Column(db.String(100))  # кодовое слово с плаката
    menu_url = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True)
    qr_ttl_minutes = db.Column(db.Integer, default=15)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class QRCode(db.Model):
    __tablename__ = 'qr_codes'
    id = db.Column(db.Integer, primary_key=True)
    bar_id = db.Column(db.Integer, db.ForeignKey('bars.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    promotion_id = db.Column(db.Integer, db.ForeignKey('promotions.id'), nullable=False)
    code = db.Column(db.String(100), unique=True, nullable=False)
    status = db.Column(db.String(20), default='issued')
    game_score = db.Column(db.Integer, default=0)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    redeemed_at = db.Column(db.DateTime)
    redeemed_by_staff_id = db.Column(db.Integer, db.ForeignKey('staff_users.id'))

class Phrase(db.Model):
    __tablename__ = 'phrases'
    id = db.Column(db.Integer, primary_key=True)
    day_number = db.Column(db.Integer, unique=True, nullable=False)
    text = db.Column(db.Text, nullable=False)

# ===========================================================
# HELPERS
# ===========================================================

def generate_token():
    return secrets.token_hex(16)
CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

def generate_short_code():
    while True:
        code = ''.join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if not QRCode.query.filter_by(code=code).first():
            return code

def create_jwt(user_id, role='guest', bar_id=None):
    payload = {
        'user_id': user_id,
        'role': role,
        'bar_id': bar_id,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth = request.headers['Authorization']
            if auth.startswith('Bearer '):
                token = auth.split(' ')[1]
        if not token:
            return jsonify({'success': False, 'message': 'Токен отсутствует'}), 401
        try:
            current_user = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        except Exception:
            return jsonify({'success': False, 'message': 'Неверный токен'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def require_role(role):
    def decorator(f):
        @wraps(f)
        def decorated(current_user, *args, **kwargs):
            if current_user.get('role') != role:
                return jsonify({'success': False, 'message': 'Доступ запрещен'}), 403
            return f(current_user, *args, **kwargs)
        return decorated
    return decorator

def generate_qr_image(code):
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(code)
    qr.make(fit=True)
    img = qr.make_image(fill_color='#0A0A0B', back_color='#FFFFFF')
    buffered = io.BytesIO()
    img.save(buffered, format='PNG')
    return base64.b64encode(buffered.getvalue()).decode()

# ===========================================================
# ГОСТЬ
# ===========================================================

@app.route('/')
def index():
    return jsonify({'status': 'ok', 'message': 'IPA Promo API работает'})

@app.route('/api/fix-promotions')
def fix_promotions():
    """Принудительно создаёт акции для всех баров"""
    code_words = ['СОСЕД', 'ЛОСЬ', 'ПИВО', 'ДРУГ']
    bars = Bar.query.all()
    created = []
    for i, bar in enumerate(bars):
        existing = Promotion.query.filter_by(bar_id=bar.id).first()
        if not existing:
            promo = Promotion(
                bar_id=bar.id,
                title='IPA Week',
                gift_name='Бесплатный бокал IPA',
                description='Назови кодовое слово и покажи QR бармену',
                code_word=code_words[i] if i < len(code_words) else f'CODE{i+1}',
                menu_url='https://taplink.cc/your_bar',
                is_active=True,
                qr_ttl_minutes=15
            )
            db.session.add(promo)
            created.append(bar.name)
    db.session.commit()
    return jsonify({
        'success': True,
        'created': created,
        'total_bars': len(bars),
        'total_promotions': Promotion.query.count()
    })


@app.route('/api/bars', methods=['GET'])

def get_bars():
    bars = Bar.query.filter_by(is_active=True).all()
    return jsonify({'success': True, 'bars': [
        {'id': b.id, 'name': b.name, 'address': b.address} for b in bars
    ]})

@app.route('/api/auth/vk', methods=['POST'])
def auth_vk():
    data = request.json
    vk_id = str(data.get('vkId'))
    if not vk_id:
        return jsonify({'success': False, 'message': 'Не передан VK ID'}), 400

    user = User.query.filter_by(vk_id=vk_id).first()
    if not user:
        user = User(vk_id=vk_id, first_name=data.get('firstName', ''),
                    last_name=data.get('lastName', ''))
        db.session.add(user)
    else:
        user.first_name = data.get('firstName', user.first_name)
        user.last_name = data.get('lastName', user.last_name)
    db.session.commit()

    return jsonify({
        'success': True,
        'token': create_jwt(user.id, role='guest'),
        'user': {'id': user.id, 'vkId': user.vk_id,
                 'firstName': user.first_name, 'lastName': user.last_name}
    })

@app.route('/api/phrase/today', methods=['GET'])
def get_phrase_today():
    vk_id = request.args.get('vkId', '0')
    today = datetime.utcnow().date()
    hash_val = int(hashlib.md5(f"{vk_id}_{today.isoformat()}".encode()).hexdigest(), 16)
    phrases = Phrase.query.all()
    if not phrases:
        return jsonify({'text': 'Хорошего дня!', 'dayNumber': 1})
    phrase = phrases[hash_val % len(phrases)]
    return jsonify({'text': phrase.text, 'dayNumber': phrase.day_number})

@app.route('/api/me', methods=['GET'])
@token_required
def get_me(current_user):
    user = User.query.get(current_user['user_id'])
    if not user:
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404

    bar_id = request.args.get('barId', type=int)
    bar = Bar.query.get(bar_id) if bar_id else None

        promo_id = request.args.get('promoId', type=int)

    active_promo = None
    if promo_id:
        active_promo = Promotion.query.filter_by(id=promo_id, is_active=True).first()
    elif bar_id:
        active_promo = Promotion.query.filter_by(is_active=True, bar_id=bar_id).first()

    redeemed_qr = None
    active_qr = None
    if active_promo:
        redeemed_qr = QRCode.query.filter_by(
            user_id=user.id, promotion_id=active_promo.id, status='redeemed').first()
        active_qr = QRCode.query.filter(
            QRCode.user_id == user.id,
            QRCode.promotion_id == active_promo.id,
            QRCode.status == 'issued',
            QRCode.expires_at > datetime.utcnow()
        ).order_by(QRCode.created_at.desc()).first()

    return jsonify({
        'success': True,
        'user': {'id': user.id, 'firstName': user.first_name, 'lastName': user.last_name},
        'bar': {'id': bar.id, 'name': bar.name} if bar else None,
        'promotion': {
            'id': active_promo.id,
            'title': active_promo.title,
            'giftName': active_promo.gift_name,
            'description': active_promo.description,
            'menuUrl': active_promo.menu_url,
            'codeWordRequired': bool(active_promo.code_word),
            'ttlMinutes': active_promo.qr_ttl_minutes
        } if active_promo else None,
        'giftStatus': 'redeemed' if redeemed_qr else ('active' if active_qr else 'available'),
        'activeQR': {
            'code': active_qr.code,
            'expiresAt': active_qr.expires_at.isoformat(),
            'gameScore': active_qr.game_score,
            'qrImage': generate_qr_image(active_qr.code)
        } if active_qr else None
    })

@app.route('/api/gift/request', methods=['POST'])
@token_required
def request_gift(current_user):
    data = request.json or {}
    bar_id = data.get('barId')
    promo_id = data.get('promoId')
    code_word = (data.get('codeWord') or '').strip().upper()

    user = User.query.get(current_user['user_id'])

    if promo_id:
        promo = Promotion.query.filter_by(id=promo_id, is_active=True).first()
    else:
        promo = Promotion.query.filter_by(bar_id=bar_id, is_active=True).first()

    if not promo:
        return jsonify({'success': False, 'message': 'Акция временно недоступна в этом баре'}), 400

    # Проверка кодового слова
    if promo.code_word and code_word != promo.code_word.upper():
        return jsonify({'success': False, 'message': 'Неверное кодовое слово'}), 400

    redeemed = QRCode.query.filter_by(
        user_id=user.id, promotion_id=promo.id, status='redeemed').first()
    if redeemed:
        return jsonify({'success': False, 'message': 'Подарок уже получен'}), 400

    existing = QRCode.query.filter(
        QRCode.user_id == user.id,
        QRCode.promotion_id == promo.id,
        QRCode.status == 'issued',
        QRCode.expires_at > datetime.utcnow()).first()
    if existing:
        return jsonify({
            'success': True, 'already': True,
            'code': existing.code,
            'expiresAt': existing.expires_at.isoformat(),
            'gameScore': existing.game_score,
            'qrImage': generate_qr_image(existing.code)
        })

    qr = QRCode(
        bar_id=promo.bar_id, user_id=user.id, promotion_id=promo.id,
        code=generate_short_code(), status='issued',
        expires_at=datetime.utcnow() + timedelta(minutes=promo.qr_ttl_minutes)
    )
    db.session.add(qr)
    db.session.commit()

    return jsonify({
        'success': True, 'already': False,
        'code': qr.code,
        'expiresAt': qr.expires_at.isoformat(),
        'gameScore': 0,
        'qrImage': generate_qr_image(qr.code)
    })

@app.route('/api/game/save', methods=['POST'])
@token_required
def save_game_score(current_user):
    data = request.json
    score = data.get('score', 0)
    user = User.query.get(current_user['user_id'])
    active_qr = QRCode.query.filter(
        QRCode.user_id == user.id,
        QRCode.status == 'issued',
        QRCode.expires_at > datetime.utcnow()
    ).order_by(QRCode.created_at.desc()).first()

    if not active_qr:
        return jsonify({'success': False, 'message': 'Нет активного QR'}), 400

    active_qr.game_score = max(active_qr.game_score, score)
    db.session.commit()
    return jsonify({'success': True, 'gameScore': active_qr.game_score})

# ===========================================================
# СЛУЖЕБНЫЙ ВХОД
# ===========================================================

@app.route('/api/staff/login', methods=['POST'])
def staff_login():
    data = request.json
    staff = StaffUser.query.filter_by(login=data.get('login'), is_active=True).first()

    if not staff or not check_password_hash(staff.password_hash, data.get('password', '')):
        return jsonify({'success': False, 'message': 'Неверный логин или пароль'}), 401

    bar = Bar.query.get(staff.bar_id)
    return jsonify({
        'success': True,
        'token': create_jwt(staff.id, role=staff.role, bar_id=staff.bar_id),
        'staff': {
            'id': staff.id, 'name': staff.name, 'role': staff.role,
            'barId': staff.bar_id, 'barName': bar.name if bar else ''
        }
    })

@app.route('/api/staff/redeem', methods=['POST'])
@token_required
@require_role('bartender')
def redeem_qr(current_user):
    data = request.json
    code = data.get('code')
    bar_id = current_user.get('bar_id')

    if not code:
        return jsonify({'success': False, 'message': 'Не передан код'}), 400

    qr = QRCode.query.filter_by(code=code, bar_id=bar_id).with_for_update().first()

    if not qr:
        other = QRCode.query.filter_by(code=code).first()
        if other:
            return jsonify({'success': False, 'status': 'wrong_bar',
                            'message': 'Этот QR из другого бара'}), 400
        return jsonify({'success': False, 'status': 'not_found', 'message': 'QR не найден'}), 404

    if qr.status == 'redeemed':
        return jsonify({'success': False, 'status': 'used', 'message': 'QR уже использован'}), 400

    if qr.expires_at < datetime.utcnow():
        qr.status = 'expired'
        db.session.commit()
        return jsonify({'success': False, 'status': 'expired', 'message': 'Срок действия QR истек'}), 400

    qr.status = 'redeemed'
    qr.redeemed_at = datetime.utcnow()
    qr.redeemed_by_staff_id = current_user['user_id']
    db.session.commit()

    return jsonify({
        'success': True, 'status': 'ok',
        'giftName': qr.promotion.gift_name,
        'userName': qr.user.first_name,
        'gameScore': qr.game_score,
        'message': f'Можно выдать: {qr.promotion.gift_name}'
    })

# ===========================================================
# АДМИН
# ===========================================================

@app.route('/api/admin/stats', methods=['GET'])
@token_required
@require_role('admin')
def admin_stats(current_user):
    today = datetime.utcnow().date()
    bar_id = request.args.get('barId', type=int)

    q = QRCode.query
    if bar_id:
        q = q.filter_by(bar_id=bar_id)

    return jsonify({'success': True, 'stats': {
        'totalUsers': User.query.count(),
        'totalGifts': q.filter_by(status='redeemed').count(),
        'activeQRs': q.filter(QRCode.status == 'issued',
                              QRCode.expires_at > datetime.utcnow()).count(),
        'guestsToday': User.query.filter(db.func.date(User.created_at) == today).count()
    }})

@app.route('/api/admin/journal', methods=['GET'])
@token_required
@require_role('admin')
def admin_journal(current_user):
    page = request.args.get('page', 1, type=int)
    bar_id = request.args.get('barId', type=int)

    q = QRCode.query.filter_by(status='redeemed')
    if bar_id:
        q = q.filter_by(bar_id=bar_id)

    qr_list = q.order_by(QRCode.redeemed_at.desc()).limit(20).offset((page - 1) * 20).all()

    result = []
    for qr in qr_list:
        staff = StaffUser.query.get(qr.redeemed_by_staff_id) if qr.redeemed_by_staff_id else None
        result.append({
            'id': qr.id,
            'userName': f"{qr.user.first_name} {qr.user.last_name or ''}".strip(),
            'giftName': qr.promotion.gift_name,
            'barName': qr.bar.name,
            'redeemedAt': qr.redeemed_at.isoformat() if qr.redeemed_at else None,
            'staffName': staff.name if staff else '—',
            'gameScore': qr.game_score
        })
    return jsonify({'success': True, 'journal': result})

@app.route('/api/admin/promotions', methods=['GET'])
@token_required
@require_role('admin')
def list_promotions(current_user):
    bar_id = request.args.get('barId', type=int)
    q = Promotion.query
    if bar_id:
        q = q.filter_by(bar_id=bar_id)
    promos = q.order_by(Promotion.created_at.desc()).all()
    return jsonify({'success': True, 'promotions': [{
        'id': p.id, 'barId': p.bar_id, 'barName': p.bar.name,
        'title': p.title, 'giftName': p.gift_name,
        'description': p.description, 'codeWord': p.code_word,
        'menuUrl': p.menu_url, 'isActive': p.is_active,
        'qrTtlMinutes': p.qr_ttl_minutes
    } for p in promos]})

@app.route('/api/admin/promotions', methods=['POST'])
@token_required
@require_role('admin')
def create_promotion(current_user):
    data = request.json
    promo = Promotion(
        bar_id=data.get('barId', 1), title=data.get('title'),
        gift_name=data.get('giftName'), description=data.get('description', ''),
        code_word=data.get('codeWord'), menu_url=data.get('menuUrl', ''),
        qr_ttl_minutes=data.get('qrTtlMinutes', 15), is_active=data.get('isActive', True)
    )
    db.session.add(promo)
    db.session.commit()
    return jsonify({'success': True, 'id': promo.id})

@app.route('/api/admin/promotions/<int:promo_id>', methods=['PATCH'])
@token_required
@require_role('admin')
def update_promotion(current_user, promo_id):
    promo = Promotion.query.get_or_404(promo_id)
    data = request.json
    for field, key in [('title', 'title'), ('gift_name', 'giftName'),
                       ('description', 'description'), ('code_word', 'codeWord'),
                       ('menu_url', 'menuUrl'), ('is_active', 'isActive'),
                       ('qr_ttl_minutes', 'qrTtlMinutes')]:
        if key in data:
            setattr(promo, field, data[key])
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/admin/promotions/<int:promo_id>', methods=['DELETE'])
@token_required
@require_role('admin')
def delete_promotion(current_user, promo_id):
    db.session.delete(Promotion.query.get_or_404(promo_id))
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/admin/staff', methods=['GET'])
@token_required
@require_role('admin')
def list_staff(current_user):
    staff = StaffUser.query.order_by(StaffUser.created_at.desc()).all()
    return jsonify({'success': True, 'staff': [{
        'id': s.id, 'barId': s.bar_id, 'barName': s.bar.name,
        'login': s.login, 'name': s.name, 'role': s.role, 'isActive': s.is_active
    } for s in staff]})

@app.route('/api/admin/staff', methods=['POST'])
@token_required
@require_role('admin')
def create_staff(current_user):
    data = request.json
    staff = StaffUser(
        bar_id=data.get('barId', 1), login=data.get('login'),
        password_hash=generate_password_hash(data.get('password')),
        name=data.get('name'), role=data.get('role', 'bartender')
    )
    db.session.add(staff)
    db.session.commit()
    return jsonify({'success': True, 'id': staff.id})

@app.route('/api/admin/staff/<int:staff_id>', methods=['DELETE'])
@token_required
@require_role('admin')
def delete_staff(current_user, staff_id):
    staff = StaffUser.query.get_or_404(staff_id)
    staff.is_active = False
    db.session.commit()
    return jsonify({'success': True})

# ===========================================================
# ИНИЦИАЛИЗАЦИЯ (4 БАРА)
# ===========================================================

def init_db():
    with app.app_context():
        db.create_all()

        default_bars = [
            {'name': 'ИПА — Коломяжский', 'address': 'Санкт-Петербург, Коломяжский проспект, 26'},
            {'name': 'ИПА — Мурино', 'address': 'Мурино, улица Шувалова, 18/8'},
            {'name': 'ИПА — Проспект Славы', 'address': 'Санкт-Петербург, проспект Славы, 16'},
            {'name': 'ИПА — Плесецкая', 'address': 'Санкт-Петербург, Плесецкая улица, 2'},
        ]
        bars = []
        for bar_data in default_bars:
            bar = Bar.query.filter_by(name=bar_data['name']).first()
            if not bar:
                bar = Bar(**bar_data)
                db.session.add(bar)
            bars.append(bar)
        db.session.commit()

        if not StaffUser.query.filter_by(login='admin').first():
            db.session.add(StaffUser(
                bar_id=bars[0].id, login='admin',
                password_hash=generate_password_hash(os.getenv('ADMIN_PASSWORD', 'admin123')),
                name='Главный админ', role='admin'))

        code_words = ['СОСЕД', 'ЛОСЬ', 'ПИВО', 'ДРУГ']
        
        # ПРИНУДИТЕЛЬНО создаём акции для каждого бара
        for i, bar in enumerate(bars):
            promo = Promotion.query.filter_by(bar_id=bar.id).first()
            if not promo:
                promo = Promotion(
                    bar_id=bar.id,
                    title='IPA Week',
                    gift_name='Бесплатный бокал IPA',
                    description='Назови кодовое слово и покажи QR бармену',
                    code_word=code_words[i],
                    menu_url='https://taplink.cc/your_bar',
                    is_active=True,
                    qr_ttl_minutes=15
                )
                db.session.add(promo)
                print(f"➕ Создана акция для бара: {bar.name}")
            else:
                # Активируем существующую акцию (на всякий случай)
                promo.is_active = True
                promo.code_word = code_words[i]
                print(f"✓ Акция обновлена для бара: {bar.name}")

        for i, bar in enumerate(bars):
            login = f'bar{i + 1}'
            if not StaffUser.query.filter_by(login=login).first():
                db.session.add(StaffUser(
                    bar_id=bar.id, login=login,
                    password_hash=generate_password_hash('123456'),
                    name=f'Бармен {bar.name}', role='bartender'))

        if Phrase.query.count() == 0:
            phrases = [
                "Ты выглядишь потрясающе именно сегодня.",
                "Твоя улыбка спасёт этот мир.",
                "Ты — причина, по которой кто-то верит в чудо.",
                "В тебе есть особенное тепло.",
                "Ты сияешь ярче любых огней этого бара.",
                "Твоя энергия заражает в хорошем смысле.",
                "У тебя безупречный вкус.",
                "Мир лучше, потому что в нём есть ты.",
                "Ты — главное событие этого вечера.",
                "Твои глаза светятся ярче барной подсветки.",
                "С тобой любой вечер становится особенным.",
                "Ты из тех людей, рядом кем хочется быть лучше.",
                "Твоя харизма работает сильнее любого маркетинга.",
                "Ты выглядишь как человек, у которого всё получится.",
                "Таких, как ты, не гуглят — таких встречают лично.",
                "Ты — живое доказательство, что чудеса существуют.",
                "Твой смех звучит лучше любого плейлиста.",
                "Ты создаёшь атмосферу, куда бы ни пришла.",
                "Сегодня твой день, и это заметно.",
                "Ты прекрасна даже до первого бокала.",
                "Рядом с тобой время идёт приятнее.",
                "Ты — тот самый ингредиент, которого всем не хватает.",
                "Твоя улыбка — лучший комплимент этому вечеру.",
                "Ты выглядишь на миллион, и это заниженная оценка.",
                "С тобой хочется делиться лучшим.",
                "Ты — человек-праздник.",
                "Твоё присутствие делает место дороже.",
                "Ты излучаешь свет, который не купить.",
                "Сегодня вселенная явно на твоей стороне.",
                "Ты — причина, по которой этот бар стал уютнее.",
                "Ты выглядишь так, будто знаешь секрет счастья.",
                "Твоя улыбка — валюта, которая дороже IPA.",
                "Ты делаешь этот вечер легендарным.",
                "Рядом с тобой даже понедельник был бы праздником.",
                "Ты — лучшее, что случалось с этим баром.",
                "Ты выглядишь как обещание хорошего вечера.",
                "Твоя энергия крепче любого IPA.",
                "Ты — человек, ради которого пишут комплименты.",
                "Сегодня ты — центр этой вселенной.",
                "Ты прекрасна. Это факт, а не мнение.",
            ]
            for i, text in enumerate(phrases, start=1):
                db.session.add(Phrase(day_number=i, text=text))

        db.session.commit()
        print(f"✅ База инициализирована, баров: {len(bars)}, акций: {Promotion.query.count()}")

init_db()
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
