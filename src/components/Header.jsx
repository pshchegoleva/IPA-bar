import logo from '../assets/logo.png';
import './Header.css';

export default function Header({ barName }) {
  return (
    <div className="header">
      <div className="header-logo">
        <img src={logo} alt="IPA" />
      </div>
      <div className="header-title">
        <h1>Рады Вас видеть!</h1>
        {barName && <p>{barName}</p>}
      </div>
    </div>
  );
}