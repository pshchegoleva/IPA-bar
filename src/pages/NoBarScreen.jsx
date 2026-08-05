import logo from '../assets/logo.png';
import './NoBarScreen.css';

export default function NoBarScreen({ onStaffEntry }) {
  return (
    <div className="no-bar-screen">
      <div className="no-bar-logo">
        <img src={logo} alt="IPA" />
      </div>
      <h1>IPA Bar</h1>
      <p className="no-bar-text">
        Отсканируй QR-код на плакате в баре, чтобы получить подарок
      </p>
      <button className="no-bar-staff" onClick={onStaffEntry}>
        Служебный вход
      </button>
    </div>
  );
}