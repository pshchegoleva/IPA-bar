import { useState, useEffect } from 'react';
import Header from '../components/Header';
import WelcomeCard from '../components/WelcomeCard';
import DailyQuote from '../components/DailyQuote';
import PromoCard from '../components/PromoCard';
import BottomMenu from '../components/BottomMenu';
import MooseGame from '../components/MooseGame';
import api from '../api';

export default function Home({ user, barId, promoId, onStaffEntry }) {
  const [activeTab, setActiveTab] = useState('home');
  const [showGame, setShowGame] = useState(false);
  const [barName, setBarName] = useState('');

  useEffect(() => {
    api.getBars().then(data => {
      const bar = (data.bars || []).find(b => b.id === barId);
      if (bar) setBarName(bar.name);
    }).catch(() => {});
  }, [barId]);

  const handleTabChange = (tab) => {
    if (tab === 'game') {
      setShowGame(true);
    } else if (tab === 'staff') {
      onStaffEntry();
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <Header barName={barName} />

      {(activeTab === 'home' || activeTab === 'gift') && (
        <>
          <WelcomeCard user={user} />
          <DailyQuote vkId={user?.id} />
          <PromoCard
            user={user}
            barId={barId}
            promoId={promoId}
          />
        </>
      )}

      <BottomMenu active={activeTab} onSelect={handleTabChange} />

      {showGame && (
        <MooseGame barId={barId} onClose={() => setShowGame(false)} />
      )}
    </div>
  );
}