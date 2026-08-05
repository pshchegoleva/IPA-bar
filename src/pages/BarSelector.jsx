import { useState, useEffect } from 'react';
import api from '../api';
import './BarSelector.css';

export default function BarSelector({ onSelect }) {
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getBars();
        setBars(data.bars || []);
      } catch (e) {
        console.error('Error loading bars:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="bar-selector">
      <div className="bar-selector-header">
        <div className="bar-logo">🦌</div>
        <h1>Выберите бар</h1>
        <p>Где вы хотите получить подарок?</p>
      </div>

      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <div className="bars-list">
          {bars.map(bar => (
            <button
              key={bar.id}
              className="bar-card"
              onClick={() => onSelect(bar.id)}
            >
              <div className="bar-icon">🍺</div>
              <div className="bar-info">
                <h3>{bar.name}</h3>
                <p>{bar.address}</p>
              </div>
              <div className="bar-arrow">→</div>
            </button>
          ))}
        </div>
      )}

      <button 
        className="staff-entry"
        onClick={() => window.location.hash = 'staff-login'}
      >
        🔐 Служебный вход
      </button>
    </div>
  );
}