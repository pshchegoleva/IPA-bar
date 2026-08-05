const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

class Api {
  constructor() {
    this.token = localStorage.getItem('token');
    this.staffToken = localStorage.getItem('staffToken');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  setStaffToken(token) {
    this.staffToken = token;
    localStorage.setItem('staffToken', token);
  }

  clearStaffToken() {
    this.staffToken = null;
    localStorage.removeItem('staffToken');
  }

  async request(path, options = {}, useStaff = false) {
    const token = useStaff ? this.staffToken : this.token;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Ошибка запроса');
    }
    return data;
  }

  // === БАРЫ ===
  async getBars() {
    return this.request('/api/bars');
  }

  // === ГОСТЬ ===
  async authVK(vkData) {
  try {
    const result = await this.request('/api/auth/vk', {
      method: 'POST',
      body: JSON.stringify({
        vkId: vkData.id,
        firstName: vkData.first_name,
        lastName: vkData.last_name,
      }),
    });
    if (result.token) {
      this.setToken(result.token);
      console.log('Токен сохранён:', result.token.substring(0, 20) + '...');
    }
    return result;
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    throw error;
  }
}

  async getMe(barId) {
    return this.request(`/api/me?barId=${barId}`);
  }

  async getPhraseToday(vkId) {
    return this.request(`/api/phrase/today?vkId=${vkId}`);
  }

  async requestGift(barId, promoId, codeWord) {
  return this.request('/api/gift/request', {
    method: 'POST',
    body: JSON.stringify({ barId, promoId, codeWord }),
  });
}

  async saveGameScore(score, barId) {
    return this.request('/api/game/save', {
      method: 'POST',
      body: JSON.stringify({ score, barId }),
    });
  }

  // === БАРМЕН ===
  async staffLogin(login, password) {
    const result = await this.request('/api/staff/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    this.setStaffToken(result.token);
    return result;
  }

  async redeemQR(code) {
    return this.request('/api/staff/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, true);
  }

  // === АДМИН ===
  async getAdminStats(barId) {
    const url = barId ? `/api/admin/stats?barId=${barId}` : '/api/admin/stats';
    return this.request(url, {}, true);
  }

  async getAdminJournal(page = 1, barId) {
    let url = `/api/admin/journal?page=${page}`;
    if (barId) url += `&barId=${barId}`;
    return this.request(url, {}, true);
  }

  async getPromotions(barId) {
    const url = barId ? `/api/admin/promotions?barId=${barId}` : '/api/admin/promotions';
    return this.request(url, {}, true);
  }

  async createPromotion(data) {
    return this.request('/api/admin/promotions', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async updatePromotion(id, data) {
    return this.request(`/api/admin/promotions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, true);
  }

  async deletePromotion(id) {
    return this.request(`/api/admin/promotions/${id}`, {
      method: 'DELETE',
    }, true);
  }

  async getStaff(barId) {
    const url = barId ? `/api/admin/staff?barId=${barId}` : '/api/admin/staff';
    return this.request(url, {}, true);
  }

  async createStaff(data) {
    return this.request('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async deleteStaff(id) {
    return this.request(`/api/admin/staff/${id}`, {
      method: 'DELETE',
    }, true);
  }
}

export default new Api();