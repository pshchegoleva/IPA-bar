import { useEffect, useState } from 'react';
import bridge from '@vkontakte/vk-bridge';

import Home from './pages/Home';
import NoBarScreen from './pages/NoBarScreen';
import BartenderPage from './pages/BartenderPage';
import AdminPage from './pages/AdminPage';
import StaffLogin from './pages/StaffLogin';
import LoadingScreen from './components/LoadingScreen';
import api from './api';

import './styles/theme.css';

function getUrlParams() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
  return {
    bar: parseInt(search.get('bar') || hash.get('bar')) || null,
    promo: parseInt(search.get('promo') || hash.get('promo')) || null,
  };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [staffUser, setStaffUser] = useState(null);
  const [params] = useState(getUrlParams());

  useEffect(() => {
    async function init() {
      let vkUser = null;

      if (bridge.isEmbedded()) {
        try {
          vkUser = await bridge.send('VKWebAppGetUserInfo');
        } catch (e) {
          console.error(e);
        }
      }

      if (!vkUser) {
        vkUser = { id: 999, first_name: 'Гость', last_name: '' };
      }

      setUser(vkUser);

      // Не блокируем интерфейс ожиданием бэкенда
      api.authVK(vkUser).catch(e => console.error('Auth error:', e));

      setLoading(false);
    }
    init();
  }, []);

  const handleStaffLogin = (staffData) => {
    setStaffUser(staffData);
    setPage(staffData.role === 'admin' ? 'admin' : 'bartender');
  };

  const handleStaffLogout = () => {
    api.clearStaffToken();
    setStaffUser(null);
    setPage('home');
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="app-root">
      {page === 'home' && (
        params.bar
          ? <Home user={user} barId={params.bar} promoId={params.promo} onStaffEntry={() => setPage('staff-login')} />
          : <NoBarScreen onStaffEntry={() => setPage('staff-login')} />
      )}

      {page === 'staff-login' && (
        <StaffLogin onLogin={handleStaffLogin} onBack={() => setPage('home')} />
      )}

      {page === 'bartender' && staffUser && (
        <BartenderPage staffUser={staffUser} onLogout={handleStaffLogout} />
      )}

      {page === 'admin' && staffUser && (
        <AdminPage staffUser={staffUser} onLogout={handleStaffLogout} />
      )}
    </div>
  );
}