import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { IconMoose, IconBeer, IconBad, IconBolt, IconClose } from './icons';
import './MooseGame.css';

const ITEMS = [
  { type: 'moose', points: 5, good: true, weight: 50 },
  { type: 'beer', points: 10, good: true, weight: 25 },
  { type: 'bad', points: -5, good: false, weight: 15 },
  { type: 'bolt', points: 0, good: true, weight: 10, special: 'double' },
];

function pickItem() {
  const total = ITEMS.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of ITEMS) {
    if ((r -= item.weight) < 0) return item;
  }
  return ITEMS[0];
}

function ItemIcon({ type, size }) {
  if (type === 'moose') return <IconMoose size={size} />;
  if (type === 'beer') return <IconBeer size={size} />;
  if (type === 'bad') return <IconBad size={size} />;
  return <IconBolt size={size} />;
}

export default function MooseGame({ barId, onClose }) {
  const [score, setScore] = useState(0);
  const [items, setItems] = useState([]);
  const [timeLeft, setTimeLeft] = useState(45);
  const [active, setActive] = useState(true);
  const [saved, setSaved] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [combo, setCombo] = useState(0);
  const [shake, setShake] = useState(false);
  const [freeze, setFreeze] = useState(false);
  const [flash, setFlash] = useState(null);
  const fieldRef = useRef(null);
  const speedRef = useRef(2);
  const lastComboBonus = useRef(0);

  // Ускорение
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      speedRef.current = Math.min(speedRef.current + 0.3, 8);
    }, 4000);
    return () => clearInterval(interval);
  }, [active]);

  // Тряска каждые 20 сек
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }, 20000);
    return () => clearInterval(interval);
  }, [active]);

  // FREEZE каждые 30 очков
  useEffect(() => {
    if (!active || score === 0 || freeze) return;
    if (score > 0 && score % 30 === 0) {
      setFreeze(true);
      const t = setTimeout(() => setFreeze(false), 2000);
      return () => clearTimeout(t);
    }
  }, [score, active, freeze]);

  // Спавн объектов
  useEffect(() => {
    if (!active || freeze) return;
    const interval = setInterval(() => {
      if (!fieldRef.current) return;
      const rect = fieldRef.current.getBoundingClientRect();
      const item = pickItem();
      const size = 56;
      setItems(prev => [...prev.slice(-12), {
        id: Date.now() + Math.random(),
        x: Math.random() * Math.max(0, rect.width - size),
        y: -size,
        speed: speedRef.current + Math.random() * 1.5,
        item,
        size,
      }]);
    }, 700);
    return () => clearInterval(interval);
  }, [active, freeze]);

  // Движение
  useEffect(() => {
    if (!active) return;
    let raf;
    const update = () => {
      setItems(prev => {
        const rect = fieldRef.current?.getBoundingClientRect();
        if (!rect) return prev;
        return prev
          .map(it => ({ ...it, y: it.y + (freeze ? 0 : it.speed) }))
          .filter(it => it.y < rect.height + 60);
      });
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [active, freeze]);

  // Таймер
  useEffect(() => {
    if (!active) return;
    const tm = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setActive(false); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(tm);
  }, [active]);

  // Тап по объекту
  const tap = (obj) => {
    if (freeze) return;
    const { item, id } = obj;
    setItems(prev => prev.filter(x => x.id !== id));

    if (item.special === 'double') {
      setMultiplier(2);
      setFlash('x2 НА 5 СЕК');
      setTimeout(() => setMultiplier(1), 5000);
      return;
    }

    const gained = item.points * multiplier;
    setScore(s => Math.max(0, s + gained));
    setFlash(gained >= 0 ? `+${gained}` : `${gained}`);
    setTimeout(() => setFlash(null), 600);

    if (item.good) {
      setCombo(c => c + 1);
    } else {
      setCombo(0);
    }
  };

  // Бонус за комбо (без бесконечного цикла)
  useEffect(() => {
    if (combo >= 5 && combo % 5 === 0 && combo !== lastComboBonus.current) {
      lastComboBonus.current = combo;
      setScore(s => s + 15);
      setFlash('КОМБО +15');
      setTimeout(() => setFlash(null), 800);
    }
  }, [combo]);

  // Сохранение результата
  useEffect(() => {
    if (!active && !saved && score > 0) {
      api.saveGameScore(score, barId)
        .then(() => setSaved(true))
        .catch(() => setSaved(true));
    }
  }, [active, saved, score, barId]);

  const restart = () => {
    setScore(0);
    setItems([]);
    setTimeLeft(45);
    setActive(true);
    setSaved(false);
    setCombo(0);
    setMultiplier(1);
    setFreeze(false);
    setFlash(null);
    speedRef.current = 2;
    lastComboBonus.current = 0;
  };

  return (
    <div className="mg-overlay">
      <div className={`mg-card ${shake ? 'shake' : ''}`}>
        <div className="mg-header">
          <h3>Поймай лося</h3>
          <button className="mg-close" type="button" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>

        <div className="mg-stats">
          <div className="mg-stat">
            <span className="mg-stat-label">Очки</span>
            <span className="mg-stat-value">{score}</span>
          </div>
          <div className="mg-stat">
            <span className="mg-stat-label">Время</span>
            <span className="mg-stat-value">{timeLeft}</span>
          </div>
          <div className="mg-stat">
            <span className="mg-stat-label">Комбо</span>
            <span className="mg-stat-value">{combo}</span>
          </div>
        </div>

        {multiplier > 1 && <div className="mg-multiplier">×{multiplier}</div>}

        {active ? (
          <div className="mg-field" ref={fieldRef}>
            {items.map(it => (
              <button
                key={it.id}
                type="button"
                className={`mg-item ${it.item.type}`}
                style={{ left: it.x, top: it.y, width: it.size, height: it.size }}
                onClick={() => tap(it)}
              >
                <ItemIcon type={it.item.type} size={it.size - 22} />
              </button>
            ))}

            {freeze && (
              <div className="mg-freeze">
                <div className="mg-freeze-text">FREEZE</div>
                <div className="mg-freeze-sub">расслабься на 2 секунды</div>
              </div>
            )}

            {flash && (
              <div className={`mg-flash ${flash.startsWith('-') ? 'bad' : 'good'}`}>
                {flash}
              </div>
            )}
          </div>
        ) : (
          <div className="mg-result">
            <h2>{score >= 50 ? 'Отличный результат!' : 'Время вышло!'}</h2>
            <p className="mg-final-score">
              Твой результат<br />
              <strong>{score} очков</strong>
            </p>
            <p className="mg-saved">{saved ? 'Результат сохранён' : 'Сохраняем...'}</p>
            <button className="mg-again" type="button" onClick={restart}>
              Играть ещё
            </button>
          </div>
        )}

        <div className="mg-hint">
          <span className="hint-item good"><IconMoose size={16} /> +5</span>
          <span className="hint-item beer"><IconBeer size={16} /> +10</span>
          <span className="hint-item bad"><IconBad size={16} /> −5</span>
          <span className="hint-item bolt"><IconBolt size={16} /> ×2</span>
        </div>
      </div>
    </div>
  );
}