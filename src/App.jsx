import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { INITIAL_BETS } from './data/bets';
import Navbar from './components/Navbar';
import BetCard from './components/BetCard';
import BetModal from './components/BetModal';
import LoginModal from './components/LoginModal';
import MyBets from './components/MyBets';
import AdminPanel from './components/AdminPanel';
import Leaderboard from './components/Leaderboard';
import Toast from './components/Toast';
import Footer from './components/Footer';

const ADMIN_EMAILS = ['20241710@novaims.unl.pt']; // ← change to your email

const TICKER = [
  "João T. colocou 300 TIPS em Cardoso chegar atrasado 💀",
  "Ana P. ganhou 1,200 TIPS no Party Animal 🏆",
  "beatriz.mf continua invicta — 14 wins seguidos 🔥",
  "Novo bet disponível ⏰",
  "Rui S. entrou all-in com 500 TIPS 💎",
];

function AppContent() {
  const { user } = useAuth();
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  const [bets, setBets] = useState([]);
  const [filter, setFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('bets');
  const [selectedBet, setSelectedBet] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [myBets, setMyBets] = useState([]);
  const [toast, setToast] = useState(null);
  const [balance, setBalance] = useState(0);
  const [lastClaim, setLastClaim] = useState(null);
  const [tickerIdx, setTickerIdx] = useState(0);

  // Ticker
  useEffect(() => {
    const t = setInterval(() => setTickerIdx(i => (i + 1) % TICKER.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Load bets on mount
  useEffect(() => { loadBets(); }, []);

  // Load user data when logged in
  useEffect(() => {
    if (user) { loadProfile(); loadMyBets(); }
    else { setBalance(0); setMyBets([]); }
  }, [user]);

  // Reload my bets & profile when switching to history tab
  useEffect(() => {
    if (activeTab === 'history' && user) { loadMyBets(); loadProfile(); }
  }, [activeTab]);

  // ── Data loaders ────────────────────────────────────────────────────────

  const loadBets = async () => {
    const { data } = await supabase
      .from('bets').select('*').eq('status', 'open').order('created_at', { ascending: false });
    setBets(data?.length ? data : INITIAL_BETS);
  };

  const loadProfile = async () => {
    let { data } = await supabase
      .from('profiles').select('balance, last_claim_at').eq('id', user.id).maybeSingle();

    if (!data) {
      // Create missing profile gracefully
      const { data: newProfile } = await supabase.from('profiles').insert([
        { id: user.id, email: user.email, balance: 2500, last_claim_at: null }
      ]).select('balance, last_claim_at').single();
      data = newProfile;
    }

    if (data) { setBalance(data.balance); setLastClaim(data.last_claim_at); }
  };

  const loadMyBets = async () => {
    const { data } = await supabase
      .from('placed_bets').select('*').eq('user_id', user.id).order('placed_at', { ascending: false });
    if (data) setMyBets(data);
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleOptionClick = (bet, option) => {
    if (!user) { setShowLogin(true); return; }
    setSelectedBet(bet);
    setSelectedOption(option);
  };

  const handlePlaceBet = async (amount) => {
    // If bet has integer ID it's from INITIAL_BETS fallback — no Supabase yet
    if (typeof selectedBet.id === 'number') {
      showToast('Supabase not set up yet — bet placement unavailable.', 'error');
      return;
    }
    const { error } = await supabase.rpc('place_bet', {
      p_bet_id: selectedBet.id,
      p_bet_title: selectedBet.title,
      p_option_label: selectedOption.label,
      p_odds: selectedOption.odds,
      p_amount: amount,
      p_potential_return: Math.floor(amount * selectedOption.odds),
    });
    if (error) { showToast(error.message, 'error'); return; }
    await loadProfile();
    await loadMyBets();
    showToast(`Bet placed! Potential return: ${Math.floor(amount * selectedOption.odds).toLocaleString()} TIPS 🎯`);
    setSelectedBet(null);
    setSelectedOption(null);
  };

  const handleClaim = async () => {
    if (!user) { setShowLogin(true); return; }
    const { error } = await supabase.rpc('claim_weekly_tips');
    if (error) {
      showToast(error.message.includes('Already claimed') ? 'Already claimed this week!' : error.message, 'error');
      return;
    }
    await loadProfile();
    showToast('+1000 TIPS claimed! 🎉');
  };


  const handleAddBet = async (newBet) => {
    // Validate: must have 2+ options with valid labels and numeric odds
    const rawOpts = newBet.options || [];
    if (!newBet.title?.trim()) {
      showToast('Bet title is required.', 'error'); return;
    }
    if (rawOpts.length < 2) {
      showToast('A bet must have at least 2 options.', 'error'); return;
    }

    // Force numeric odds (never store "Auto" or empty strings)
    const opts = rawOpts.map(o => ({ label: o.label.trim(), odds: parseFloat(o.odds) }));

    if (opts.some(o => !o.label || isNaN(o.odds) || o.odds <= 1)) {
      showToast('All options need a label and odds greater than 1.', 'error'); return;
    }

    const payload = { ...newBet, options: opts }; // Pass plain array — Supabase serializes JSONB automatically
    console.log('[handleAddBet] Inserting bet:', JSON.stringify(payload, null, 2));

    const { error } = await supabase.from('bets').insert([payload]);
    if (error) { showToast('Error publishing bet: ' + error.message, 'error'); return; }
    await loadBets();
    showToast('Bet published! ✅');
  };

  const handleResolveBet = async (betId, winningOption) => {
    const { error } = await supabase.rpc('resolve_bet', {
      p_bet_id: betId,
      p_winning_option: winningOption,
    });
    if (error) { showToast('Error resolving: ' + error.message, 'error'); return; }
    await loadBets();
    await loadProfile();
    showToast(`Resolved! "${winningOption}" wins. TIPS credited to winners ✅`);
  };

  // ── Derived state ────────────────────────────────────────────────────────

  const canClaim = !lastClaim || (new Date() - new Date(lastClaim)) / (1000 * 60 * 60 * 24) >= 7;

  const filteredBets = bets.filter(b => {
    if (filter === 'Hot') return b.trending;
    if (filter === 'Closing') {
      const label = b.closes_in_label || b.closesIn || '';
      return label.includes('m') || (label.includes('h') && !label.includes('d'));
    }
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', color: '#1a1a1a', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;900&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {toast && <Toast {...toast} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {selectedBet && selectedOption && (
        <BetModal bet={selectedBet} option={selectedOption} balance={balance}
          onConfirm={handlePlaceBet}
          onClose={() => { setSelectedBet(null); setSelectedOption(null); }} />
      )}

      <Navbar onLoginClick={() => setShowLogin(true)} balance={balance}
        activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} />

      {/* ── BETS TAB ── */}
      {activeTab === 'bets' && (
        <>
          {/* Hero */}
          <div style={{ 
            padding: '60px 32px 50px', position: 'relative', overflow: 'hidden', 
            backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 100%), url("/logo.jpg.jpeg")',
            backgroundSize: 'cover', backgroundPosition: 'center',
            borderBottom: '1px solid #e5e7eb', marginBottom: 24 
          }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 20, padding: '6px 16px', marginBottom: 16, fontSize: 11, color: '#fca5a5', fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                ⚠️ FOR ENTERTAINMENT ONLY
              </div>

              <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 12px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1, color: '#ffffff' }}>
                IMS BEST TIPS.<br/>
                <span style={{ color: '#a3e635' }}>Dicas que marcam.</span>
              </h1>
              <p style={{ fontSize: 16, color: '#e2e8f0', maxWidth: 500, margin: '0 0 24px', lineHeight: 1.6, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                A plataforma oficial de previsões da NOVA IMS. Virtual, grátis.
              </p>
              {!user && (
                <button onClick={() => setShowLogin(true)} style={{ background: '#84cc16', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 8, padding: '12px 28px', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 6px -1px rgba(132, 204, 22, 0.2)' }}>
                  Entrar com @novaims 🎓
                </button>
              )}
            </div>
          </div>

          {/* Main grid */}
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 60px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {/* Bets */}
            <div style={{ flex: 1, minWidth: 'min(100%, 600px)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['All', 'Hot', 'Closing'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    background: filter === f ? '#84cc16' : '#ffffff',
                    border: filter === f ? '1px solid #84cc16' : '1px solid #e5e7eb',
                    color: filter === f ? '#fff' : '#666',
                    borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>{f === 'Hot' ? '🔥 Hot' : f === 'Closing' ? '⏰ Closing' : f}</button>
                ))}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Bets</span>
                <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{filteredBets.length} available</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredBets.map(bet => (
                  <BetCard key={bet.id} bet={{ ...bet, closesIn: bet.closes_in_label || bet.closesIn }} onOptionClick={handleOptionClick} />
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Wallet */}
              <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: 12, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>A tua Carteira</div>
                <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", color: '#1a1a1a', letterSpacing: -1, marginBottom: 4 }}>
                  <span style={{ color: '#84cc16' }}>TIPS</span> {user ? balance.toLocaleString() : '—'}
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>Saldo disponível</div>
                
                <button onClick={handleClaim} style={{
                  width: '100%',
                  background: canClaim ? '#f0f9ff' : '#f3f4f6',
                  border: canClaim ? '1px solid #bae6fd' : '1px solid #e5e7eb',
                  color: canClaim ? '#0369a1' : '#9ca3af', borderRadius: 8, padding: '12px 0',
                  fontSize: 14, fontWeight: 700, cursor: canClaim ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}>{canClaim ? '🎁 Claim weekly +1000 TIPS' : '✓ Claimed this week'}</button>
              </div>
              
              {/* Disclaimer */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px' }}>
                <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, margin: 0, textAlign: 'center', fontWeight: 500 }}>
                  ⚠️ FOR ENTERTAINMENT ONLY<br />NO REAL MONEY · ALL CURRENCY VIRTUAL
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── LEADERBOARD TAB ── */}
      {activeTab === 'leaderboard' && (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px 60px' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 24, margin: '0 0 24px', letterSpacing: -0.5, color: '#1a1a1a' }}>Global Leaderboard 🏆</h2>
          <Leaderboard />
        </div>
      )}

      {/* ── MY BETS TAB ── */}
      {activeTab === 'history' && (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px 60px' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 24, margin: '0 0 24px', letterSpacing: -0.5, color: '#1a1a1a' }}>My Bets</h2>
          {!user ? (
            <div style={{ textAlign: 'center', padding: '60px 0', background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: '#1a1a1a' }}>Login to see your bets</div>
              <button onClick={() => setShowLogin(true)} style={{ background: '#84cc16', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 8, padding: '12px 24px', cursor: 'pointer' }}>Login 🎓</button>
            </div>
          ) : <MyBets myBets={myBets} />}
        </div>
      )}

      {/* ── ADMIN TAB ── */}
      {activeTab === 'admin' && isAdmin && (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px 60px' }}>
          <AdminPanel openBets={bets} onAddBet={handleAddBet} onResolveBet={handleResolveBet} />
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}