import logo from '../assets/logo.png';
import './LoadingScreen.css';

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <img src={logo} alt="IPA" />
      </div>
      <div className="loading-spinner"></div>
    </div>
  );
}