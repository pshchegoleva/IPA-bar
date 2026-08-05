import { useState, useEffect } from 'react';
import api from '../api';
import { IconCrown, IconLogout, IconChart, IconList, IconGift, IconUsers, IconTrash, IconMoose } from '../components/icons';
import './AdminPage.css';

export default function AdminPage({ staffUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [journal, setJournal] = useState([]);
  const [bars, setBars] = useState([]);
  const [selectedBar, setSelectedBar] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    loadData();
  }, [selectedBar, activeTab]);

  const loadData = async () => {
    try {
      const barsData = await api.getBars();
      setBars(barsData.bars || []);

      if (activeTab === 'stats') {
        const d = await api.getAdminStats(selectedBar);
        setStats(d.stats);
      }
      if (activeTab === 'journal') {
        const d = await api.getAdminJournal(1, selectedBar);
        setJournal(d.journal || []);
      }
      if (activeTab === 'promotions') {
        const d = await api.getPromotions(selectedBar);
        setPromotions(d.promotions || []);
      }
      if (activeTab === 'staff') {
        const d = await api.getStaff(selectedBar);
        setStaff(d.staff || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const togglePromotion = async (promo) => {
    try {
      await api.updatePromotion(promo.id, { isActive: !promo.isActive });
      loadData();
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  };

  const deletePromotion = async (promo) => {
    if (confirm(`Удалить акцию "${promo.title}"?`)) {
      try {
        await api.deletePromotion(promo.id);
        loadData();
      } catch (e) {
        alert('Ошибка: ' + e.message);
      }
    }
  };

  const deleteStaff = async (member) => {
    if (confirm(`Отключить сотрудника "${member.name}"?`)) {
      try {
        await api.deleteStaff(member.id);
        loadData();
      } catch (e) {
        alert('Ошибка: ' + e.message);
      }
    }
  };

  const tabs = [
    { id: 'stats', label: 'Статистика', Icon: IconChart },
    { id: 'journal', label: 'Журнал', Icon: IconList },
    { id: 'promotions', label: 'Акции', Icon: IconGift },
    { id: 'staff', label: 'Бармены', Icon: IconUsers },
  ];

  return (
    <div className="ap-page">
      <div className="ap-header">
        <div className="ap-info">
          <div className="ap-avatar"><IconCrown size={24} /></div>
          <div>
            <h3>{staffUser.name}</h3>
            <p>{staffUser.barName}</p>
          </div>
        </div>
        <button className="ap-logout" onClick={onLogout}>
          <IconLogout size={16} /> Выйти
        </button>
      </div>

      <div className="ap-tabs">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={activeTab === id ? 'active' : ''}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="ap-filter">
        <select
          value={selectedBar || ''}
          onChange={(e) => setSelectedBar(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">Все бары</option>
          {bars.map(bar => (
            <option key={bar.id} value={bar.id}>{bar.name}</option>
          ))}
        </select>
      </div>

      {activeTab === 'stats' && stats && (
        <div className="ap-stats">
          <div className="ap-stat-card">
            <div className="ap-stat-value">{stats.totalUsers}</div>
            <div className="ap-stat-label">Всего гостей</div>
          </div>
          <div className="ap-stat-card">
            <div className="ap-stat-value">{stats.guestsToday}</div>
            <div className="ap-stat-label">Гостей сегодня</div>
          </div>
          <div className="ap-stat-card">
            <div className="ap-stat-value">{stats.totalGifts}</div>
            <div className="ap-stat-label">Выдано подарков</div>
          </div>
          <div className="ap-stat-card">
            <div className="ap-stat-value">{stats.activeQRs}</div>
            <div className="ap-stat-label">Активные QR</div>
          </div>
        </div>
      )}

      {activeTab === 'journal' && (
        <div className="ap-list">
          {journal.length === 0 ? (
            <p className="ap-empty">Пока нет выданных подарков</p>
          ) : (
            journal.map(item => (
              <div key={item.id} className="ap-journal-item">
                <div className="ap-journal-left">
                  <strong>{item.userName}</strong>
                  <span>{item.barName}</span>
                </div>
                <div className="ap-journal-mid">
                  <span>{item.giftName}</span>
                  <span className="ap-journal-staff">{item.staffName}</span>
                </div>
                <div className="ap-journal-score">
                  <IconMoose size={16} /> {item.gameScore}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'promotions' && (
        <div className="ap-list">
          {promotions.length === 0 ? (
            <p className="ap-empty">Нет акций</p>
          ) : (
            promotions.map(promo => (
              <div key={promo.id} className="ap-row">
                <div className="ap-row-info">
                  <strong>{promo.title}</strong>
                  <span>{promo.giftName} • {promo.barName}</span>
                  {promo.codeWord && <span className="ap-codeword">Слово: {promo.codeWord}</span>}
                  <span className={`ap-status ${promo.isActive ? 'on' : 'off'}`}>
                    {promo.isActive ? 'Активна' : 'Выключена'}
                  </span>
                </div>
                <div className="ap-row-actions">
                  <button
                    className={promo.isActive ? 'ap-off' : 'ap-on'}
                    onClick={() => togglePromotion(promo)}
                  >
                    {promo.isActive ? 'Выкл' : 'Вкл'}
                  </button>
                  <button className="ap-del" onClick={() => deletePromotion(promo)}>
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="ap-list">
          {staff.length === 0 ? (
            <p className="ap-empty">Нет сотрудников</p>
          ) : (
            staff.map(member => (
              <div key={member.id} className="ap-row">
                <div className="ap-row-info">
                  <strong>{member.name}</strong>
                  <span>{member.barName} • {member.role === 'admin' ? 'Админ' : 'Бармен'}</span>
                </div>
                <button className="ap-del" onClick={() => deleteStaff(member)}>
                  <IconTrash size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}