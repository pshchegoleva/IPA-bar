import { useState, useEffect } from 'react';
import api from '../api';
import './DailyQuote.css';

export default function DailyQuote({ vkId }) {
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    api.getPhraseToday(vkId || 0)
      .then(data => setQuote(data.text))
      .catch(() => setQuote('Ты выглядишь потрясающе именно сегодня.'));
  }, [vkId]);

  if (!quote) return null;

  return (
    <div className="quote-card">
      <div className="quote-header">Специально для тебя</div>
      <div className="quote-text">{quote}</div>
    </div>
  );
}