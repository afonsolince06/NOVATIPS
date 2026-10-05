import { useState, useEffect, useCallback } from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { isFreshersWeekendDemo, isFreshersWeekendEdition, supabase } from './lib/supabase';
import { FRESHERS_WEEKEND_DEMO_BETS, FRESHERS_WEEKEND_SECTIONS } from './data/freshersWeekendDemo';
import Navbar from './components/Navbar';
import BetCard from './components/BetCard';
import LoginModal from './components/LoginModal';
import MyBets from './components/MyBets';
import AdminPanel from './components/AdminPanel';
import Leaderboard from './components/Leaderboard';
import FdsSidebar from './components/FdsSidebar';
import MegaBoost from './components/MegaBoost';
import { findActiveMegaBoost } from './lib/megaBoost';
import BetSlipModal from './components/BetSlipModal';
import ProfileModal from './components/ProfileModal';
import Toast from './components/Toast';
import Footer from './components/Footer';
import { useNotifications } from './hooks/useNotifications';

const ADMIN_EMAILS = ['20241710@novaims.unl.pt']; // ← change to your email

function AppContent() {
  const { user, passwordRecovery, finishPasswordRecovery } = useAuth();
  const [weekendAdminUserId, setWeekendAdminUserId] = useState(null);
  const isAdmin = isFreshersWeekendEdition
    ? Boolean(user && weekendAdminUserId === user.id)
    : Boolean(user && ADMIN_EMAILS.includes(user.email));

  const [bets, setBets] = useState([]);
  const [filter, setFilter] = useState('All');
  const [filterNow, setFilterNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setFilterNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [activeDemoSection, setActiveDemoSection] = useState('all');
  const [expandedPoster, setExpandedPoster] = useState(null);
  const [activeTab, setActiveTab] = useState('bets');
  const [betSlip, setBetSlip] = useState([]);
  const [isBetSlipOpen, setIsBetSlipOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [myBets, setMyBets] = useState([]);
  const [toast, setToast] = useState(null);
  const [balance, setBalance] = useState(0);
  const [username, setUsername] = useState(null);
  const [lastClaim, setLastClaim] = useState(null);

  // Push Notification hook
  const { subscribed: notifSubscribed, loading: notifLoading, supported: notifSupported, toggle: notifToggle } = useNotifications(user);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    if (!expandedPoster) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExpandedPoster(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expandedPoster]);

  const fetchBets = useCallback(async () => {
    if (isFreshersWeekendDemo) return FRESHERS_WEEKEND_DEMO_BETS;
    const { data } = await supabase
      .from('bets').select('*').eq('status', 'open').order('created_at', { ascending: false });
    return data || [];
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!user) return null;
    let { data } = await supabase
      .from('profiles').select('balance, last_claim_at, username').eq('id', user.id).maybeSingle();

    if (!data) {
      const { data: newProfile } = await supabase.from('profiles').insert([
        { id: user.id, email: user.email, balance: 2500, last_claim_at: null }
      ]).select('balance, last_claim_at, username').single();
      data = newProfile;
    }

    return data;
  }, [user]);

  const fetchMyBets = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase
      .from('placed_bets').select('*').eq('user_id', user.id).order('placed_at', { ascending: false });
    return data || [];
  }, [user]);

  const loadBets = useCallback(async () => setBets(await fetchBets()), [fetchBets]);
  const loadProfile = useCallback(async () => {
    const data = await fetchProfile();
    if (data) { setBalance(data.balance); setLastClaim(data.last_claim_at); setUsername(data.username); }
  }, [fetchProfile]);
  const loadMyBets = useCallback(async () => setMyBets(await fetchMyBets()), [fetchMyBets]);

  // Detect referral code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('referralCode', ref);
      // Clean URL without reloading page
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  // Process referral code once user is logged in
  useEffect(() => {
    if (user) {
      const ref = localStorage.getItem('referralCode');
      if (ref && ref !== user.id) {
        supabase.rpc('process_referral', { p_referrer_id: ref })
          .then(({ error }) => {
            if (!error) {
              showToast('Código de amigo ativado! Ganhaste +500 TIPS 🎁');
              loadProfile(); // update balance
            }
            localStorage.removeItem('referralCode'); // only try once
          });
      }
    }
  }, [user, showToast, loadProfile]);

  // Load bets on mount
  useEffect(() => {
    let active = true;
    fetchBets().then(data => { if (active) setBets(data); });
    return () => { active = false; };
  }, [fetchBets]);

  useEffect(() => {
    document.title = isFreshersWeekendEdition
      ? 'NOVA TIPS | Edição Fds do Caloiro'
      : 'NOVA TIPS';
  }, []);

  // Load user data when logged in
  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchProfile().then(data => {
      if (active && data) {
        setBalance(data.balance);
        setLastClaim(data.last_claim_at);
        setUsername(data.username);
      }
    });
    fetchMyBets().then(data => { if (active) setMyBets(data); });
    return () => { active = false; };
  }, [user, fetchProfile, fetchMyBets]);

  useEffect(() => {
    if (!isFreshersWeekendEdition || !user) return;

    let active = true;
    supabase.rpc('freshers_weekend_is_admin').then(({ data, error }) => {
      if (active) setWeekendAdminUserId(!error && data === true ? user.id : null);
    });
    return () => { active = false; };
  }, [user]);

  // Reload my bets & profile when switching to history tab
  useEffect(() => {
    if (activeTab !== 'history' || !user) return;
    let active = true;
    fetchMyBets().then(data => { if (active) setMyBets(data); });
    fetchProfile().then(data => {
      if (active && data) {
        setBalance(data.balance);
        setLastClaim(data.last_claim_at);
        setUsername(data.username);
      }
    });
    return () => { active = false; };
  }, [activeTab, user, fetchMyBets, fetchProfile]);

  // Supabase Realtime — show in-app toast when a new bet is published
  useEffect(() => {
    if (isFreshersWeekendDemo) return undefined;
    const channel = supabase
      .channel('public:bets:inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bets' },
        (payload) => {
          if (payload.new?.status === 'open') {
            showToast(`🎯 Nova aposta: ${payload.new.title}`, 'info');
            loadBets();
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bets' }, () => loadBets())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadBets, showToast]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleOptionClick = (bet, option) => {
    if (isFreshersWeekendDemo) {
      showToast('Demonstração visual: as apostas ainda não estão ligadas.', 'info');
      return;
    }
    if (bet.closes_at && new Date(bet.closes_at).getTime() <= Date.now()) { showToast('Esta previsão já fechou.', 'info'); return; }
    if (!user) { setShowLogin(true); return; }

    const existingIndex = betSlip.findIndex(item => item.bet.id === bet.id);

    if (existingIndex !== -1) {
      if (betSlip[existingIndex].option.label === option.label) {
        setBetSlip(prev => prev.filter((_, i) => i !== existingIndex)); // remove
      } else {
        setBetSlip(prev => { // replace option
          const newSlip = [...prev];
          newSlip[existingIndex] = { bet, option };
          return newSlip;
        });
      }
    } else {
      setBetSlip(prev => [...prev, { bet, option }]); // add
    }
  };

  const handlePlaceBetSlip = async (amount, totalOdds, potentialReturn) => {
    if (betSlip.length === 0) return;

    if (betSlip.length === 1) {
      const item = betSlip[0];
      if (typeof item.bet.id === 'number') {
        showToast('Supabase not set up yet — bet placement unavailable.', 'error');
        return;
      }
      const { error } = await supabase.rpc('place_bet', {
        p_bet_id: item.bet.id,
        p_option_label: item.option.label,
        p_amount: amount
      });
      if (error) { showToast(error.message, 'error'); return; }
    } else {
      const legs = betSlip.map(item => ({
        bet_id: item.bet.id,
        bet_title: item.bet.title,
        option_label: item.option.label,
        odds: item.option.odds,
        status: 'pending'
      }));

      const { error } = await supabase.rpc('place_multiple_bet', {
        p_amount: amount,
        p_legs: legs
      });
      if (error) { showToast(error.message, 'error'); return; }
    }

    await loadProfile();
    await loadMyBets();
    showToast(`Aposta colocada! Retorno possível: ${potentialReturn.toLocaleString()} TIPS 🎯`);
    setBetSlip([]);
    setIsBetSlipOpen(false);
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

    const payload = { ...newBet, options: opts };
    if (!isFreshersWeekendEdition) delete payload.closes_at;
    console.log('[handleAddBet] Inserting bet:', JSON.stringify(payload, null, 2));

    const { error } = await supabase.from('bets').insert([payload]);
    if (error) { showToast('Error publishing bet: ' + error.message, 'error'); return; }
    await loadBets();

    // Send push notification to all subscribers
    try {
      await supabase.functions.invoke('send-bet-notification', {
        body: {
          title: `🎯 Nova aposta: ${payload.title}`,
          body: payload.description || 'Entra e faz a tua previsão!',
        }
      });
    } catch (e) {
      console.warn('[Push] Could not send push notification:', e);
    }

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

  const handleDeleteBet = async (betId) => {
    if (!window.confirm("Tens a certeza que queres APAGAR esta aposta? Todos os TIPS apostados nela serão devolvidos.")) return;
    const { error } = await supabase.rpc('delete_bet', { p_bet_id: betId });
    if (error) { showToast('Error deleting: ' + error.message, 'error'); return; }
    await loadBets();
    await loadProfile();
    showToast(`Aposta apagada e saldos reembolsados! 🗑️`);
  };

  const handleAdminPasswordReset = async (email) => {
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { email },
    });
    if (error) {
      let message = error.message;
      try {
        const response = await error.context.json();
        if (response.error) message = response.error;
      } catch {
        // Keep the SDK error when the response has no JSON details.
      }
      throw new Error(message);
    }
    if (!data?.temporaryPassword) throw new Error('The reset completed without returning a temporary password.');
    return data;
  };

  // ── Derived state ────────────────────────────────────────────────────────

  const canClaim = !lastClaim || (new Date() - new Date(lastClaim)) / (1000 * 60 * 60 * 24) >= 7;

  const megaBoost = isFreshersWeekendEdition ? findActiveMegaBoost(bets, filterNow) : null;

  const filteredBets = bets.filter(b => {
    if (b.id === megaBoost?.id) return false;
    if (filter === 'Hot') return b.trending;
    if (filter === 'Closing') {
      if (isFreshersWeekendEdition && b.closes_at) {
        const remaining = new Date(b.closes_at).getTime() - filterNow;
        return remaining > 0 && remaining <= 3 * 60 * 60 * 1000;
      }
      const label = b.closes_in_label || b.closesIn || '';
      return label.includes('m') || (label.includes('h') && !label.includes('d'));
    }
    return true;
  });

  const visibleWeekendSections = FRESHERS_WEEKEND_SECTIONS.filter(section =>
    activeDemoSection === 'all' || section.id === activeDemoSection
  );

  return (
    <div className={isFreshersWeekendEdition ? 'app-shell fds-app' : 'app-shell'} style={{ minHeight: '100vh', background: '#f5f7fa', color: '#1a1a1a', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;900&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {toast && <Toast {...toast} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      {isBetSlipOpen && (
        <BetSlipModal
          betSlip={betSlip}
          balance={balance}
          onConfirm={handlePlaceBetSlip}
          onClose={() => setIsBetSlipOpen(false)}
          onRemove={(betId) => setBetSlip(prev => prev.filter(item => item.bet.id !== betId))}
        />
      )}

      {(isProfileOpen || passwordRecovery || user?.user_metadata?.force_password_change === true) && user && (
        <ProfileModal
          user={user}
          balance={balance}
          username={username}
          setUsername={setUsername}
          forcePasswordChange={passwordRecovery || user.user_metadata?.force_password_change === true}
          passwordRecovery={passwordRecovery}
          onClose={() => {
            if (user.user_metadata?.force_password_change !== true) setIsProfileOpen(false);
          }}
          onPasswordChanged={() => { finishPasswordRecovery?.(); setIsProfileOpen(false); }}
          onSignOut={async () => {
            await supabase.auth.signOut();
            setIsProfileOpen(false);
            setBetSlip([]);
            setIsBetSlipOpen(false);
            setBalance(0);
            setMyBets([]);
            setUsername(null);
            setLastClaim(null);
          }}
        />
      )}

      {/* Sticky Bet Slip Bar */}
      {user && betSlip.length > 0 && !isBetSlipOpen && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)', maxWidth: 400,
          background: '#84cc16',
          borderRadius: 16, padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 10px 25px rgba(132, 204, 22, 0.4)', zIndex: 300, cursor: 'pointer'
        }} onClick={() => setIsBetSlipOpen(true)}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>
              {betSlip.length === 1 ? 'Aposta Simples' : `Múltipla (${betSlip.length})`}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 600 }}>
              {betSlip.map(item => item.bet.title).join(', ').substring(0, 30)}...
            </span>
          </div>
          <div style={{
            background: '#fde047', color: '#1a1a1a', fontWeight: 800, fontSize: 16,
            padding: '6px 12px', borderRadius: 8, border: '1px solid #facc15'
          }}>
            {(betSlip.reduce((acc, curr) => acc * curr.option.odds, 1)).toFixed(2)}
          </div>
        </div>
      )}

      <Navbar
        onLoginClick={() => !isFreshersWeekendDemo && setShowLogin(true)}
        onProfileClick={() => setIsProfileOpen(true)}
        balance={balance}
        activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin}
        hideLogin={isFreshersWeekendDemo}
        fdsMode={isFreshersWeekendEdition}
        notifSubscribed={notifSubscribed}
        notifLoading={notifLoading}
        notifSupported={notifSupported}
        onNotifToggle={notifToggle}
      />

      {/* ── BETS TAB ── */}
      {activeTab === 'bets' && (
        <>
          {/* Hero */}
          <div className={isFreshersWeekendEdition ? 'fds-event-hero' : undefined} style={{
            padding: isFreshersWeekendEdition ? '34px 40px 38px' : '60px 32px 50px', position: 'relative', overflow: 'hidden',
            backgroundImage: isFreshersWeekendEdition
              ? 'linear-gradient(90deg, rgba(20, 7, 36, 0.94) 0%, rgba(27, 8, 43, 0.8) 53%, rgba(29, 9, 45, 0.58) 100%), url("/fds/neon-party.jpeg")'
              : 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 100%), url("/logo.jpg.jpeg")',
            backgroundSize: 'cover', backgroundPosition: 'center',
            borderBottom: '1px solid #e5e7eb', marginBottom: 24
          }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'relative', zIndex: 10 }}>
              {isFreshersWeekendEdition && (
                <div className="fds-hero-badge">
                  EDIÇÃO FDS DO CALOIRO
                </div>
              )}
              <div className={isFreshersWeekendEdition ? 'fds-entertainment-badge' : undefined} style={isFreshersWeekendEdition ? undefined : { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 20, padding: '6px 16px', marginBottom: 16, fontSize: 11, color: '#fca5a5', fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                ⚠️ FOR ENTERTAINMENT ONLY
              </div>

              <h1 className={isFreshersWeekendEdition ? 'fds-hero-title' : undefined} style={{ fontSize: isFreshersWeekendEdition ? 48 : 'clamp(32px, 5vw, 52px)', fontWeight: 900, lineHeight: 1.02, margin: '0 0 12px', fontFamily: "'Space Grotesk', sans-serif", color: '#ffffff', maxWidth: 800 }}>
                {isFreshersWeekendEdition ? (
                  <><span className="fds-brand-title">NOVA <em>TIPS</em></span><span className="fds-hero-question">ACHAS QUE SABES O QUE VAI ACONTECER NO FDS?</span></>
                ) : (
                  <>IMS BEST TIPS.<br /><span style={{ color: '#a3e635' }}>Dicas que marcam.</span></>
                )}
              </h1>
              <p className={isFreshersWeekendEdition ? 'fds-hero-copy' : undefined} style={{ fontSize: 16, color: '#e2e8f0', maxWidth: 500, margin: '0 0 24px', lineHeight: 1.6, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {isFreshersWeekendEdition ? 'Faz as tuas previsões. Ganha TIPS. Sobe no ranking.' : 'A plataforma oficial de previsões da NOVA IMS. Virtual, grátis.'}
              </p>
              {!user && !isFreshersWeekendDemo && (
                <button onClick={() => setShowLogin(true)} style={{ background: '#84cc16', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 8, padding: '12px 28px', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 6px -1px rgba(132, 204, 22, 0.2)' }}>
                  Entrar com @novaims 🎓
                </button>
              )}
            </div>
          </div>

          {/* Main grid */}
          <div className={isFreshersWeekendEdition ? 'fds-main-grid' : undefined} style={{ maxWidth: isFreshersWeekendEdition ? 1440 : 1100, margin: '0 auto', padding: '0 24px 60px', display: isFreshersWeekendEdition ? 'grid' : 'flex', gridTemplateColumns: isFreshersWeekendEdition ? 'minmax(0, 1fr) 300px' : undefined, alignItems: 'start', gap: 24, flexWrap: 'wrap' }}>
            {/* Bets */}
            <div className={isFreshersWeekendEdition ? 'fds-main-column' : undefined} style={{ flex: 1, minWidth: 'min(100%, 600px)' }}>
              {isFreshersWeekendEdition ? (
                <div className="fds-demo">
                  <div className="fds-demo-intro">
                    <div>
                      <span className="fds-demo-kicker">{isFreshersWeekendDemo ? 'ACTIVE BETS · DEMO VISUAL' : 'APOSTAS ATIVAS · FDS DO CALOIRO'}</span>
                      <h2>Escolhe o ambiente</h2>
                    </div>
                    <span className="fds-demo-total">{filteredBets.length} previsões</span>
                  </div>
                  {!isFreshersWeekendDemo && (
                    <div className="fds-demo-filters" aria-label="Filtrar apostas">
                      {['All', 'Hot', 'Closing'].map(option => (
                        <button
                          type="button"
                          key={option}
                          className={filter === option ? 'is-active' : ''}
                          aria-pressed={filter === option}
                          onClick={() => setFilter(option)}
                        >{option === 'Hot' ? '🔥 Hot' : option === 'Closing' ? '⏰ A fechar' : 'Todas'}</button>
                      ))}
                    </div>
                  )}
                  <div className="fds-demo-tabs" role="tablist" aria-label="Secções de apostas">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeDemoSection === 'all'}
                      className={activeDemoSection === 'all' ? 'is-active' : ''}
                      onClick={() => setActiveDemoSection('all')}
                    >Todas <span>{filteredBets.length}</span></button>
                    {FRESHERS_WEEKEND_SECTIONS.map(section => {
                      const count = filteredBets.filter(bet => bet.section === section.id).length;
                      return (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeDemoSection === section.id}
                          className={activeDemoSection === section.id ? 'is-active' : ''}
                          key={section.id}
                          onClick={() => setActiveDemoSection(section.id)}
                        >{section.label} <span>{count}</span></button>
                      );
                    })}
                  </div>
                  {isFreshersWeekendDemo && <p className="fds-demo-note">Apostas de exemplo, sem ligação a contas ou saldos.</p>}

                  {megaBoost && <MegaBoost bet={megaBoost} onExpandImage={setExpandedPoster} onOptionClick={handleOptionClick} selectedOptionLabel={betSlip.find(item => item.bet.id === megaBoost.id)?.option.label} />}

                  <div className="fds-demo-sections">
                    {visibleWeekendSections.map(section => {
                      const sectionBets = filteredBets.filter(bet => (bet.section || 'general') === section.id);
                      if (!sectionBets.length) return null;
                      return (
                        <section className={`fds-demo-section theme-${section.theme}`} key={section.id}>
                          <div className="fds-demo-section-head">
                            <span className="fds-demo-symbol" aria-hidden="true">{section.symbol}</span>
                            <div>
                              <span className="fds-demo-eyebrow">{section.eyebrow}</span>
                              <h3>{section.title}</h3>
                              <p>{section.description}</p>
                            </div>
                            <div className="fds-demo-section-meta">
                              <span className="fds-demo-section-count">{sectionBets.length} {sectionBets.length === 1 ? 'previsão' : 'previsões'}</span>
                              {section.poster && (
                                <button
                                  type="button"
                                  className="fds-demo-poster-button"
                                  aria-label={`Ampliar cartaz: ${section.title}`}
                                  onClick={() => setExpandedPoster(section)}
                                >
                                  <img className="fds-demo-poster" src={section.poster} alt="" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="fds-demo-bets">
                            {sectionBets.map(bet => {
                              const selectedItem = betSlip.find(item => item.bet.id === bet.id);
                              return (
                                <BetCard
                                  key={bet.id}
                                  bet={{ ...bet, closesIn: bet.closes_in_label || bet.closesIn }}
                                  onOptionClick={handleOptionClick}
                                  selectedOptionLabel={selectedItem ? selectedItem.option.label : null}
                                  variant="fds"
                                />
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                    {visibleWeekendSections.every(section => !filteredBets.some(bet => (bet.section || 'general') === section.id)) && (
                      <div className="fds-demo-empty">{isFreshersWeekendDemo ? 'Sem apostas nesta secção com o filtro atual.' : 'Ainda não há apostas nesta secção.'}</div>
                    )}
                  </div>
                </div>
              ) : (
                <>
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

              {filteredBets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>🏁</div>
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: '#1a1a1a', fontFamily: "'Space Grotesk', sans-serif" }}>Nenhuma aposta disponível</div>
                  <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>A equipa da NOVA TIPS está a preparar novas previsões.<br/>Volta mais tarde!</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {filteredBets.map(bet => {
                    const selectedItem = betSlip.find(item => item.bet.id === bet.id);
                    return (
                      <BetCard
                        key={bet.id}
                        bet={{ ...bet, closesIn: bet.closes_in_label || bet.closesIn }}
                        onOptionClick={handleOptionClick}
                        selectedOptionLabel={selectedItem ? selectedItem.option.label : null}
                      />
                    );
                  })}
                </div>
              )}
                </>
              )}
            </div>

            {/* Sidebar */}
            <div className={isFreshersWeekendEdition ? 'fds-sidebar-column' : undefined} style={{ width: isFreshersWeekendEdition ? undefined : 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {isFreshersWeekendEdition ? (
                <FdsSidebar
                  username={username}
                  user={user}
                  balance={balance}
                  myBets={myBets}
                  canClaim={canClaim}
                  onClaim={handleClaim}
                  onViewLeaderboard={() => setActiveTab('leaderboard')}
                  isDemo={isFreshersWeekendDemo}
                />
              ) : <>
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
              </>}
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
          <AdminPanel
            openBets={bets}
            onAddBet={handleAddBet}
            onMegaBoostSaved={loadBets}
            onResolveBet={handleResolveBet}
            onDeleteBet={handleDeleteBet}
            onResetPassword={isFreshersWeekendEdition ? handleAdminPasswordReset : null}
            enableSections={isFreshersWeekendEdition}
            sections={FRESHERS_WEEKEND_SECTIONS}
          />
        </div>
      )}

      <Footer />
      {expandedPoster && (
        <div
          className="fds-poster-lightbox"
          role="presentation"
          tabIndex={-1}
          onKeyDown={event => {
            if (event.key === 'Escape') setExpandedPoster(null);
          }}
          onClick={() => setExpandedPoster(null)}
        >
          <div
            className="fds-poster-lightbox-content"
            role="dialog"
            aria-modal="true"
            aria-label={`Cartaz: ${expandedPoster.title}`}
            onKeyDown={event => {
              if (event.key === 'Escape') setExpandedPoster(null);
            }}
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="fds-poster-lightbox-close"
              aria-label="Fechar cartaz ampliado"
              autoFocus
              onKeyDown={event => {
                if (event.key === 'Escape') setExpandedPoster(null);
              }}
              onClick={() => setExpandedPoster(null)}
            >×</button>
            <img src={expandedPoster.poster} alt={`Cartaz: ${expandedPoster.title}`} />
            <p>{expandedPoster.title}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return isFreshersWeekendDemo
    ? <AppContent />
    : <AuthProvider><AppContent /></AuthProvider>;
}