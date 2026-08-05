import './WelcomeCard.css';

export default function WelcomeCard({ user }) {
  const firstName = user?.first_name || 'Гость';

  return (
    <div className="welcome-card">
      <div className="welcome-small">Добро пожаловать</div>
      <div className="welcome-name">{firstName}!</div>
      <div className="welcome-text">
        Мы приготовили для тебя кое-что особенное.
        Назови кодовое слово с плаката и получи подарок у бармена.
      </div>
    </div>
  );
}