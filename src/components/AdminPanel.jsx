import { useState } from 'react';

// Auto-generates a fair opposite odd with a small house margin.
// e.g. Sim @ 1.70 → Não @ ~2.23
function generateOppositeOdds(simOdds) {
  const o = parseFloat(simOdds);
  if (!o || o <= 1.01) return '';
  return (Math.round((o / (o - 1)) * 0.92 * 100) / 100).toFixed(2);
}

export default function AdminPanel({ openBets = [], onAddBet, onResolveBet, onDeleteBet }) {

  // ── Create Bet form ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    title: '', description: '', closesInLabel: '24h',
    opt1Label: 'Sim', opt1Odds: '',
    opt2Label: 'Não', opt2Odds: '',
    trending: false, featured: false,
  });
  const [formError, setFormError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // When Sim odds change, auto-fill Não odds
  const handleOpt1OddsChange = (val) => {
    set('opt1Odds', val);
    const autoOdds = generateOppositeOdds(val);
    if (autoOdds) set('opt2Odds', autoOdds);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    setFormError('');

    const o1 = parseFloat(form.opt1Odds);
    const o2 = parseFloat(form.opt2Odds);

    if (!form.opt1Label.trim() || !form.opt2Label.trim()) {
      setFormError('Both option labels are required.'); return;
    }
    if (!o1 || o1 <= 1) {
      setFormError('Option 1 odds must be greater than 1.'); return;
    }
    if (!o2 || o2 <= 1) {
      setFormError('Option 2 odds must be greater than 1.'); return;
    }

    onAddBet({
      title: form.title.trim(),
      description: form.description.trim(),
      closes_in_label: form.closesInLabel,
      trending: form.trending,
      featured: form.featured,
      options: [
        { label: form.opt1Label.trim(), odds: o1 },
        { label: form.opt2Label.trim(), odds: o2 },
      ],
      status: 'open',
    });

    setForm({ title: '', description: '', closesInLabel: '24h', opt1Label: 'Sim', opt1Odds: '', opt2Label: 'Não', opt2Odds: '', trending: false, featured: false });
  };

  // ── Resolve Bet section ──────────────────────────────────────────────────
  const [resolvingId, setResolvingId] = useState(null);
  const [winningOption, setWinningOption] = useState('');

  const confirmResolve = () => {
    if (!resolvingId || !winningOption) return;
    onResolveBet(resolvingId, winningOption);
    setResolvingId(null);
    setWinningOption('');
  };

  const inp = {
    width: '100%', background: '#ffffff',
    border: '1px solid #cbd5e1', borderRadius: 10,
    padding: '12px 14px', color: '#1a1a1a', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
    transition: 'border-color 0.2s',
  };
  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── RESOLVE BETS ── */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 24, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, margin: '0 0 6px', color: '#14532d' }}>✅ Resolve Bets</h2>
        <p style={{ color: '#166534', fontSize: 13, margin: '0 0 20px' }}>Select the winning outcome — winners get TIPS credited automatically.</p>

        {openBets.filter(b => typeof b.id !== 'number').length === 0 ? (
          <div style={{ color: '#166534', fontSize: 14, textAlign: 'center', padding: '16px 0', fontWeight: 600 }}>No open bets to resolve.</div>
        ) : openBets.filter(b => typeof b.id !== 'number').map(bet => {
          // Safe parse: handle string-encoded options from legacy bug
          let opts = [];
          try { opts = typeof bet.options === 'string' ? JSON.parse(bet.options) : (bet.options || []); } catch { opts = []; }

          const isResolving = resolvingId === bet.id;
          return (
            <div key={bet.id} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px', marginBottom: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{bet.title}</div>
                <button onClick={() => onDeleteBet(bet.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Apagar 🗑️</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: isResolving ? 16 : 0 }}>
                {opts.map((opt, i) => (
                  <button key={i} onClick={() => { setResolvingId(bet.id); setWinningOption(opt.label); }}
                    style={{
                      flex: 1, minWidth: 100,
                      background: (isResolving && winningOption === opt.label) ? '#dcfce7' : '#f8fafc',
                      border: (isResolving && winningOption === opt.label) ? '1px solid #4ade80' : '1px solid #e2e8f0',
                      color: (isResolving && winningOption === opt.label) ? '#166534' : '#475569',
                      borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      transition: 'all 0.15s'
                    }}>
                    {opt.label} <span style={{ color: (isResolving && winningOption === opt.label) ? '#15803d' : '#1e90ff', fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>{Number(opt.odds).toFixed(2)}</span>
                  </button>
                ))}
              </div>
              {isResolving && winningOption && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={confirmResolve} style={{ flex: 1, background: '#10b981', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', borderRadius: 8, padding: '12px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}>
                    Confirm: "{winningOption}" wins 🏆
                  </button>
                  <button onClick={() => { setResolvingId(null); setWinningOption(''); }} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: 8, padding: '12px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── CREATE BET ── */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, margin: '0 0 4px', color: '#1a1a1a' }}>⚙️ Publish New Bet</h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 20px' }}>
          Enter Option 1 odds — Option 2 ("Não") is calculated automatically. You can override it.
        </p>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={lbl}>Title *</label>
            <input style={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Autogolo do Henrique" required onFocus={e => e.target.style.borderColor = '#1e90ff'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
          </div>
          <div><label style={lbl}>Description</label>
            <input style={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description..." onFocus={e => e.target.style.borderColor = '#1e90ff'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
          </div>
          <div><label style={lbl}>Closes In</label>
            <input style={inp} value={form.closesInLabel} onChange={e => set('closesInLabel', e.target.value)} placeholder="e.g. 24h or 2h 30m" onFocus={e => e.target.style.borderColor = '#1e90ff'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
          </div>

          {/* Options — always 2 */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e90ff', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
              Options (2 required)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Option 1 Label *</label>
                <input style={inp} value={form.opt1Label} onChange={e => set('opt1Label', e.target.value)} placeholder="Sim" required onFocus={e => e.target.style.borderColor = '#1e90ff'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
              </div>
              <div>
                <label style={lbl}>Option 1 Odds *</label>
                <input style={inp} type="number" step="0.01" min="1.02" value={form.opt1Odds}
                  onChange={e => handleOpt1OddsChange(e.target.value)} placeholder="e.g. 1.70" required onFocus={e => e.target.style.borderColor = '#1e90ff'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
              </div>
              <div>
                <label style={lbl}>Option 2 Label *</label>
                <input style={inp} value={form.opt2Label} onChange={e => set('opt2Label', e.target.value)} placeholder="Não" required onFocus={e => e.target.style.borderColor = '#1e90ff'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
              </div>
              <div>
                <label style={lbl}>Option 2 Odds * <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 500, textTransform: 'none' }}>(auto-filled)</span></label>
                <input style={{ ...inp, borderColor: form.opt2Odds ? '#1e90ff' : '#cbd5e1' }}
                  type="number" step="0.01" min="1.02" value={form.opt2Odds}
                  onChange={e => set('opt2Odds', e.target.value)} placeholder="Auto" required onFocus={e => e.target.style.borderColor = '#1e90ff'} onBlur={e => e.target.style.borderColor = form.opt2Odds ? '#1e90ff' : '#cbd5e1'} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, margin: '8px 0' }}>
            {[['trending', '📈 Mark as Hot'], ['featured', '★ Feature on top']].map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: form[key] ? '#1e90ff' : '#64748b', fontWeight: 500 }}>
                <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} style={{ accentColor: '#1e90ff', width: 16, height: 16 }} />
                {label}
              </label>
            ))}
          </div>

          {formError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
              ⚠️ {formError}
            </div>
          )}

          <button type="submit" style={{ background: '#1e90ff', color: '#fff', fontWeight: 800, fontSize: 15, border: 'none', borderRadius: 12, padding: '14px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(30, 144, 255, 0.2)' }}>
            Publish Bet 🚀
          </button>
        </form>
      </div>
    </div>
  );
}
