import { IconHome, IconGift, IconMoose, IconLock } from './icons';
import './BottomMenu.css';

export default function BottomMenu({ active, onSelect }) {
  const items = [
    { id: 'home', label: 'Главная', Icon: IconHome },
    { id: 'gift', label: 'Подарок', Icon: IconGift },
    { id: 'game', label: 'Игра', Icon: IconMoose },
    { id: 'staff', label: 'Вход', Icon: IconLock },
  ];

  return (
    <div className="bottom-menu">
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`bottom-menu-item ${active === id ? 'active' : ''}`}
          onClick={() => onSelect(id)}
        >
          <span className="menu-icon"><Icon size={22} /></span>
          <span className="menu-label">{label}</span>
        </button>
      ))}
    </div>
  );
}