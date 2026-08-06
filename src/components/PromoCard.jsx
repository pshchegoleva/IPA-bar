import { useState, useEffect } from 'react';
import api from '../api';
import { IconGift, IconMoose } from './icons';
import './PromoCard.css';

export default function PromoCard({ user, barId, promoId, onGiftReceived }) {
  const [qr, setQr] = useState(null);
  const [promo, setPromo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState('available');
  const [codeWord, setCodeWord] = useState('');

  useEffect(() => {
    if (barId) loadStatus();
  }, [barId]);

  const loadStatus = async () => {
    try {
      const me = await api.getMe(barId, promoId);
      setPromo(me.promotion);
      setStatus(me.giftStatus);
      if (me.activeQR) {
        setQr(me.activeQR);
        const expires = new Date(me.activeQR.expiresAt);
        setTimeLeft(Math.max(0, Math.floor((expires - new Date()) / 1000)));
        onGiftReceived?.(me.activeQR);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setStatus('available');
          setQr(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleGetGift = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.requestGift(barId, promoId, codeWord);
      const expires = new Date(result.expiresAt);
      setQr({ code: result.code, qrImage: result.qrImage, gameScore: result.gameScore });
      setTimeLeft(Math.floor((expires - new Date()) / 1000));
      setStatus('active');
      onGiftReceived?.({ code: result.code });
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!promo) {
    return (
      <div className="promo-card">
        <div className="promo-icon"><IconBeerBig /></div>
        <h2 className="promo-title">Акция временно недоступна</h2>
        <p className="promo-description">Скоро здесь появится новое предложение. Следите за плакатами!</p>
      </div>
    );
  }

  if (status === 'redeemed') {
    return (
      <div className="promo-card">
        <div className="promo-icon"><IconGift size={44} color="#D3874B" /></div>
        <h2 className="promo-title">Подарок получен!</h2>
        <p className="promo-description">Спасибо, что заглянул к нам. Ждём тебя снова!</p>
      </div>
    );
  }

  if (status === 'active' && qr) {
    const code = qr.code.toUpperCase();
    const prettyCode = `${code.slice(0, 3)} ${code.slice(3)}`;

    return (
      <div className="promo-card">
        <h2 className="promo-title">Твой подарок</h2>
        <p className="promo-description">{promo.giftName}</p>

        <div className="qr-wrapper">
          <img src={`data:image/png;base64,${qr.qrImage}`} alt="QR" className="qr-image" />
        </div>

        <div className="timer-box">{formatTime(timeLeft)}</div>
        <p className="timer-text">Покажи QR или назови код бармену</p>

        <div className="code-box">
          <span className="code-label">Код подарка</span>
          <span className="code-value">{prettyCode}</span>
        </div>

        {qr.gameScore > 0 && (
          <div className="game-score">
            <IconMoose size={18} color="#D3874B" />
            <span>Поймано лосей: <strong>{qr.gameScore}</strong></span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="promo-card">
      <div className="promo-icon"><IconGift size={44} color="#D3874B" /></div>
      <h2 className="promo-title">{promo.title}</h2>
      <p className="promo-description">{promo.description || promo.giftName}</p>

      {promo.codeWordRequired && (
        <input
          type="text"
          className="codeword-input"
          placeholder="Кодовое слово с плаката"
          value={codeWord}
          onChange={(e) => setCodeWord(e.target.value)}
          autoCapitalize="characters"
        />
      )}

      <button className="promo-main-button" onClick={handleGetGift} disabled={loading}>
        {loading ? 'Получаем...' : 'Получить подарок'}
      </button>

      {error && <p className="error-text">{error}</p>}

      {promo.menuUrl && (
        <a className="menu-link" href={promo.menuUrl} target="_blank" rel="noreferrer">
          Открыть меню →
        </a>
      )}
    </div>
  );
}

function IconBeerBig() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#D3874B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8z" />
      <path d="M16 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
      <path d="M6 8c0-3 2-5 5-5s5 2 5 5" />
      <path d="M9 12v5M13 12v5" />
    </svg>
  );
}
