import { useState } from 'react';
import VectorDashboard from './components/dashboard/VectorDashboard.jsx';
import MediaPlanTimeline from './components/mediaplan/MediaPlanTimeline.jsx';
import CampaignCreate from './components/campaigns/CampaignCreate.jsx';
import CampaignDashboard from './components/campaigns/CampaignDashboard.jsx';

const NAV = [
  { section: 'Мониторинг', items: [
    { id: 'dashboard', label: 'VECTOR Dashboard', icon: '◈' },
  ]},
  { section: 'Кампании', items: [
    { id: 'campaigns', label: 'Список кампаний', icon: '▤' },
    { id: 'campaign-create', label: 'Создать кампанию', icon: '⊕' },
  ]},
  { section: 'Контент', items: [
    { id: 'mediaplan', label: 'Медиаплан', icon: '▦' },
  ]},
];

export default function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <>
      <header className="app-header">
        <div className="app-header__logo">
          MYD<span>igital</span> — LED MEDIA BORD
        </div>
      </header>

      <div className="app-layout">
        <aside className="app-sidebar">
          {NAV.map((section) => (
            <nav key={section.section} className="nav-section">
              <div className="nav-section__title">{section.section}</div>
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className={`nav-item ${page === item.id ? 'nav-item--active' : ''}`}
                  onClick={() => setPage(item.id)}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </nav>
          ))}
        </aside>

        <main className="app-main">
          {page === 'dashboard' && <VectorDashboard />}
          {page === 'campaigns' && <CampaignDashboard />}
          {page === 'campaign-create' && <CampaignCreate />}
          {page === 'mediaplan' && <MediaPlanTimeline />}
        </main>
      </div>
    </>
  );
}
