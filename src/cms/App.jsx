import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.tsx';
import { UserRole } from './types/auth.ts';

import LoginPage from './components/auth/LoginPage.tsx';
import ProtectedRoute from './components/auth/ProtectedRoute.tsx';
import RoleRoute from './components/auth/RoleRoute.tsx';

import VectorDashboard from './components/dashboard/VectorDashboard.jsx';
import MediaPlanTimeline from './components/mediaplan/MediaPlanTimeline.jsx';
import CampaignCreate from './components/campaigns/CampaignCreate.jsx';
import CampaignDashboard from './components/campaigns/CampaignDashboard.jsx';
import UserManagement from './components/users/UserManagement.tsx';

const NAV = [
  { section: 'Мониторинг', items: [
    { id: '/dashboard', label: 'VECTOR Dashboard', icon: '◈', roles: [UserRole.ADMIN, UserRole.OPERATOR] },
  ]},
  { section: 'Кампании', items: [
    { id: '/campaigns', label: 'Список кампаний', icon: '▤', roles: [UserRole.ADMIN, UserRole.OPERATOR, UserRole.AGENT, UserRole.CLIENT] },
    { id: '/campaigns/create', label: 'Создать кампанию', icon: '⊕', roles: [UserRole.ADMIN, UserRole.OPERATOR, UserRole.AGENT] },
  ]},
  { section: 'Контент', items: [
    { id: '/mediaplan', label: 'Медиаплан', icon: '▦', roles: [UserRole.ADMIN, UserRole.OPERATOR] },
  ]},
  { section: 'Администрирование', items: [
    { id: '/admin/users', label: 'Пользователи', icon: '◔', roles: [UserRole.ADMIN] },
  ]},
];

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasRole } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasRole(...item.roles)),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      <header className="app-header">
        <div className="app-header__logo">
          MYD<span>igital</span> — LED MEDIA BORD
        </div>
        <div className="app-header__user">
          <span className="app-header__user-name">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="app-header__user-role">{user?.role}</span>
          <button className="app-header__logout" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="app-sidebar">
          {visibleNav.map((section) => (
            <nav key={section.section} className="nav-section">
              <div className="nav-section__title">{section.section}</div>
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className={`nav-item ${location.pathname === item.id ? 'nav-item--active' : ''}`}
                  onClick={() => navigate(item.id)}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </nav>
          ))}
        </aside>

        <main className="app-main">
          <Routes>
            <Route path="/dashboard" element={<VectorDashboard />} />
            <Route path="/campaigns" element={<CampaignDashboard />} />
            <Route path="/campaigns/create" element={<CampaignCreate />} />
            <Route path="/mediaplan" element={<MediaPlanTimeline />} />

            <Route element={<RoleRoute allowed={[UserRole.ADMIN]} />}>
              <Route path="/admin/users" element={<UserManagement />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<AppShell />} />
      </Route>
    </Routes>
  );
}
