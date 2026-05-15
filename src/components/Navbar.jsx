import { useAuth } from '../context/AuthContext';

export default function Navbar({ onLoginClick, balance, activeTab, setActiveTab, isAdmin }) {
  const { user, signOut } = useAuth();
  const initial = user?.email?.[0]?.toUpperCase() ?? '?';

  const tabs = ['bets', 'history', ...(isAdmin ? ['admin'] : [])];
  const tabLabels = { bets: 'Bets', history: 'My Bets', admin: '⚙️ Admin' };

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 28px', borderBottom: '1px solid #e5e7eb',
      backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,0.95)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: '#1e90ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 16, color: '#fff',
        }}>N</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5, fontFamily: "'Space Grotesk', sans-serif", color: '#1a1a1a' }}>
            NOVA{' '}
            <span style={{ color: '#1e90ff' }}>
              TIPS
            </span>
          </div>
          <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
            Entertainment Only
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? '#eff6ff' : 'transparent',
              border: 'none',
              color: activeTab === tab ? '#1e90ff' : '#64748b',
              borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{tabLabels[tab]}</button>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 20, padding: '6px 14px',
          }}>
            <span style={{ fontSize: 13, color: '#166534', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
              TIPS {balance.toLocaleString()}
            </span>
          </div>
        )}

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: '#e0f0ff', color: '#1e90ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14,
            }}>{initial}</div>
            <button
              onClick={signOut}
              style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#ef4444', borderRadius: 8, padding: '6px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Logout</button>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            style={{
              background: '#1e90ff',
              color: '#fff', fontWeight: 700, fontSize: 13, border: 'none',
              borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(30, 144, 255, 0.2)'
            }}
          >Login 🎓</button>
        )}
      </div>
    </nav>
  );
}
