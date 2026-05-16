import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onLoginClick, balance, activeTab, setActiveTab, isAdmin }) {
  const { user, signOut } = useAuth();
  const initial = user?.email?.[0]?.toUpperCase() ?? '?';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tabs = ['bets', 'leaderboard', 'history', ...(isAdmin ? ['admin'] : [])];
  const tabLabels = { bets: 'Bets', leaderboard: 'Leaderboard', history: 'My Bets', admin: '⚙️ Admin' };

  return (
    <nav style={{
      display: 'flex', flexDirection: 'column',
      padding: '14px 16px', borderBottom: '1px solid #e5e7eb',
      backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,0.95)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
    }}>
      {/* Top Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img 
            src="/logo.jpg.jpeg" 
            alt="N" 
            style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', background: '#84cc16' }} 
          />
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5, fontFamily: "'Space Grotesk', sans-serif", color: '#1a1a1a' }}>
              NOVA <span style={{ color: '#84cc16' }}>TIPS</span>
            </div>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
              Entertainment Only
            </div>
          </div>
        </div>

        {/* Desktop Tabs */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 4 }}>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? '#ecfccb' : 'transparent',
                  border: 'none', color: activeTab === tab ? '#65a30d' : '#64748b',
                  borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{tabLabels[tab]}</button>
            ))}
          </div>
        )}

        {/* Right Side (Wallet & Hamburger) */}
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

          {/* Desktop User Info & Logout */}
          {!isMobile && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: '#ecfccb', color: '#65a30d',
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
          )}

          {!user && (
            <button
              onClick={onLoginClick}
              style={{
                background: '#84cc16', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none',
                borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(132, 204, 22, 0.2)'
              }}
            >Login 🎓</button>
          )}

          {/* Hamburger Icon */}
          {isMobile && (
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{ 
                background: 'transparent', border: 'none', cursor: 'pointer', 
                padding: '4px', display: 'flex', flexDirection: 'column', gap: 4 
              }}
            >
              <div style={{ width: 22, height: 3, background: '#1a1a1a', borderRadius: 2 }} />
              <div style={{ width: 22, height: 3, background: '#1a1a1a', borderRadius: 2 }} />
              <div style={{ width: 22, height: 3, background: '#1a1a1a', borderRadius: 2 }} />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobile && isMenuOpen && (
        <div style={{ 
          width: '100%', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8,
          borderTop: '1px solid #e5e7eb', paddingTop: 16
        }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setIsMenuOpen(false); }}
              style={{
                background: activeTab === tab ? '#ecfccb' : '#f8fafc',
                border: '1px solid', borderColor: activeTab === tab ? '#d9f99d' : '#e2e8f0',
                color: activeTab === tab ? '#65a30d' : '#475569',
                borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 700,
                textAlign: 'center', cursor: 'pointer',
              }}
            >{tabLabels[tab]}</button>
          ))}
          {user && (
            <button
              onClick={() => { signOut(); setIsMenuOpen(false); }}
              style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#ef4444', borderRadius: 8, padding: '12px',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                textAlign: 'center'
              }}
            >Logout</button>
          )}
        </div>
      )}
    </nav>
  );
}
