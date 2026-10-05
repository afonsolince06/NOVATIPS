import { useEffect, useState } from 'react';
import { rankLeaderboard } from '../lib/leaderboard';
import { supabase } from '../lib/supabase';

const DEMO_LEADERS = [
  { username: 'maria.ims', balance: 8420 },
  { username: 'joao.nova', balance: 7980 },
  { username: 'pedro.fds', balance: 7540 },
];

export default function FdsSidebar({ user, balance, username, myBets, canClaim, onClaim, onViewLeaderboard, isDemo }) {
  const [leaders, setLeaders] = useState(isDemo ? DEMO_LEADERS : []);
  const [rank, setRank] = useState(null);
  const wins = myBets.filter(bet => bet.status === 'Won').length;

  useEffect(() => {
    if (isDemo || !user) return undefined;
    let active = true;
    supabase
      .from('event_leaderboard')
      .select('*')
      .order('balance', { ascending: false })
      .then(async ({ data, error }) => {
        if (active && !error && data) {
          const {data:stats,error:statsError}=await supabase.rpc('event_prediction_statistics');
          if (!active || statsError) return;
          const byId=new Map(stats.map(s=>[s.user_id,s]));
          const ranked = rankLeaderboard(data.map(u=>({...u,...byId.get(u.id)})));
          setLeaders(ranked.slice(0, 3));
          const ownRank = ranked.find(entry => entry.id === user.id)?.rank;
          setRank(ownRank || null);
        }
      });
    return () => { active = false; };
  }, [isDemo, user, balance, username]);

  return (
    <aside className="fds-sidebar">
      <section className="fds-wallet-panel">
        <div className="fds-sidebar-label">A tua carteira</div>
        <div className="fds-wallet-balance">
          <span>TIPS</span>
          <strong>{user ? balance.toLocaleString('pt-PT') : '—'}</strong>
        </div>
        <div className="fds-wallet-caption">Saldo virtual disponível</div>
        <div className="fds-player-stats">
          <div>
            <span className="fds-stat-icon">🏆</span>
            <span>{isDemo ? 'Prévia de ranking' : rank ? `#${rank} no ranking` : user ? 'A calcular ranking' : 'Entra para jogar'}</span>
          </div>
          <div>
            <span className="fds-stat-icon">✓</span>
            <span>{wins} previsões certas</span>
          </div>
        </div>
        <button className="fds-claim-button" type="button" onClick={onClaim} disabled={!canClaim || isDemo}>
          <span aria-hidden="true">🎁</span>
          {isDemo ? 'Recompensa semanal' : canClaim ? 'Reclamar +1000 TIPS' : 'Recompensa reclamada'}
        </button>
      </section>

      <section className="fds-leaderboard-panel">
        <div className="fds-leaderboard-heading">
          <div>
            <div className="fds-sidebar-label">Competição do FDS</div>
            <h2>Top do FDS</h2>
          </div>
          <div className="fds-leaderboard-heading-meta">
            {isDemo && <span className="fds-demo-label">EXEMPLO</span>}
            <span className="fds-trophy" aria-hidden="true">🏆</span>
          </div>
        </div>
        {(isDemo || user) && leaders.length ? (
          <ol className="fds-leader-list">
            {leaders.map((entry, index) => (
              <li key={entry.username || index}>
                <span className={`fds-rank rank-${index + 1}`}>{entry.rank || index + 1}</span>
                <span className="fds-leader-avatar">{(entry.username?.[0] || entry.student_number?.[0] || '?').toUpperCase()}</span>
                <span className="fds-leader-name">{entry.username || entry.student_number || 'Caloiro'}</span>
                <strong>{Number(entry.balance || 0).toLocaleString('pt-PT')}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="fds-leader-empty">
            {isDemo ? 'Os nomes apresentados são apenas um exemplo.' : user ? 'Ainda não há posições para mostrar.' : 'Inicia sessão para veres a classificação do FDS.'}
          </p>
        )}
        <button type="button" className="fds-leader-link" onClick={onViewLeaderboard}>
          Ver leaderboard completo <span aria-hidden="true">→</span>
        </button>
      </section>

      <div className="fds-disclaimer">
        <span aria-hidden="true">ⓘ</span>
        <p>PARA ENTRETENIMENTO<br />Sem dinheiro real · Só TIPS virtuais</p>
      </div>
    </aside>
  );
}