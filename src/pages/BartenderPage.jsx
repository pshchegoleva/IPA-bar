import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../api';
import { IconUser, IconLogout, IconCamera, IconKeyboard, IconClose, IconMoose, IconGift, IconBeer } from '../components/icons';
import './BartenderPage.css';

export default function BartenderPage({ staffUser, onLogout }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanner = () => {
    setScanning(true);
    setResult(null);

    setTimeout(() => {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScan(decodedText.trim());
          stopScanner();
        },
        () => {}
      ).catch(() => {
        setScanning(false);
        setResult({ success: false, status: 'error', message: 'Не удалось запустить камеру. Используйте ручной ввод.' });
      });
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleScan = async (code) => {
    try {
      const data = await api.redeemQR(code);
      setResult(data);
    } catch (err) {
      setResult({ success: false, status: err.message?.includes('использован') ? 'used' : err.message?.includes('истек') ? 'expired' : 'error', message: err.message });
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      await handleScan(manualCode.trim().toUpperCase());
      setManualCode('');
      setShowManual(false);
    }
  };

  const statusClass = () => {
    if (!result) return '';
    if (result.success) return 'ok';
    if (result.status === 'used') return 'used';
    if (result.status === 'expired') return 'expired';
    return 'error';
  };

  return (
    <div className="bp-page">
      <div className="bp-header">
        <div className="bp-info">
          <div className="bp-avatar"><IconBeer size={24} color="#D3874B" /></div>
          <div>
            <h3>{staffUser.name}</h3>
            <p>{staffUser.barName}</p>
          </div>
        </div>
        <button className="bp-logout" onClick={onLogout}>
          <IconLogout size={16} /> Выйти
        </button>
      </div>

      <div className="bp-card">
        <h2>Сканер QR-кодов</h2>

        <div id="qr-reader" className="bp-reader" style={{ display: scanning ? 'block' : 'none' }}></div>

        {!scanning && (
          <div className="bp-buttons">
            <button className="bp-scan" onClick={startScanner}>
              <IconCamera size={20} /> Сканировать QR
            </button>
            <button className="bp-manual" onClick={() => setShowManual(true)}>
              <IconKeyboard size={20} /> Ручной ввод
            </button>
          </div>
        )}

        {scanning && (
          <button className="bp-stop" onClick={stopScanner}>Остановить сканер</button>
        )}

        {showManual && (
          <form onSubmit={handleManualSubmit} className="bp-manual-form">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Например: K7M2P9"
              autoFocus
            />
            <button type="submit">Проверить</button>
            <button type="button" onClick={() => setShowManual(false)}>Отмена</button>
          </form>
        )}
      </div>

      {result && (
        <div className={`bp-result ${statusClass()}`}>
          <div className="bp-result-dot"></div>
          <h3>{result.message || result.giftName}</h3>

          {result.success && (
            <div className="bp-details">
              <p><span>Подарок</span><strong>{result.giftName}</strong></p>
              <p><span>Гость</span><strong>{result.userName}</strong></p>
              <p><span>Лосей поймано</span><strong>{result.gameScore}</strong></p>
            </div>
          )}

          <button className="bp-close" onClick={() => setResult(null)}>
            <IconClose size={16} /> Закрыть
          </button>
        </div>
      )}
    </div>
  );
}