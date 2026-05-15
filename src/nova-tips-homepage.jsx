import { useState, useEffect, useRef } from "react";

const BETS = [
  {
    id: 1,
    title: "Jolas no CVV",
    description: "Over 100.5 jolas dadas gratuitamente no próximo CVV",
    category: "Campus Life",
    categoryEmoji: "🏛️",
    options: [{ label: "Over 100.5", odds: 1.85 }, { label: "Under 100.5", odds: 2.10 }],
    volume: 12450,
    participants: 87,
    closesIn: "2h 34m",
    trending: true,
    featured: true,
    tag: "🔥 HOT",
  },
  {
    id: 2,
    title: "Party Animal Prize",
    description: "Quem ganha o prémio Party Animal do semestre?",
    category: "Awards",
    categoryEmoji: "🏆",
    options: [{ label: "João M.", odds: 2.30 }, { label: "Ana P.", odds: 3.10 }, { label: "Rui S.", odds: 5.00 }],
    volume: 8820,
    participants: 54,
    closesIn: "1d 12h",
    trending: true,
    featured: false,
    tag: "👑 AWARD",
  },
  {
    id: 3,
    title: "Chega Atrasado?",
    description: "O professor Cardoso chega atrasado à próxima aula de Data Mining?",
    category: "Professors",
    categoryEmoji: "🎓",
    options: [{ label: "Sim, claro 😂", odds: 1.45 }, { label: "Não desta vez", odds: 3.80 }],
    volume: 5210,
    participants: 41,
    closesIn: "45m",
    trending: false,
    featured: false,
    tag: "⏰ CLOSING",
  },
  {
    id: 4,
    title: "Casal do Semestre",
    description: "Casal mais provável a começar no semestre?",
    category: "Social",
    categoryEmoji: "💘",
    options: [{ label: "Beatriz & Tiago", odds: 2.00 }, { label: "Sofia & Diogo", odds: 2.80 }, { label: "Dark horse 🐴", odds: 6.00 }],
    volume: 19900,
    participants: 132,
    closesIn: "3d 8h",
    trending: true,
    featured: false,
    tag: "💘 SPICY",
  },
  {
    id: 5,
    title: "AI Count",
    description: "Quantas vezes o prof diz 'AI' na próxima aula de GDI?",
    category: "In-Class",
    categoryEmoji: "🤖",
    options: [{ label: "Over 20.5", odds: 1.70 }, { label: "Under 20.5", odds: 2.25 }],
    volume: 3400,
    participants: 29,
    closesIn: "5h 10m",
    trending: false,
    featured: false,
    tag: "🤖 NERD",
  },
  {
    id: 6,
    title: "Biblioteca Nap",
    description: "Quem adormece primeiro na biblioteca durante a época de exames?",
    category: "Exams",
    categoryEmoji: "📚",
    options: [{ label: "Miguel T.", odds: 2.10 }, { label: "Carolina R.", odds: 3.50 }, { label: "Pedro V.", odds: 4.00 }],
    volume: 7600,
    participants: 63,
    closesIn: "6d 2h",
    trending: false,
    featured: false,
    tag: "😴 ZZZ",
  },
];

const LEADERBOARD = [
  { rank: 1, name: "beatriz.mf", tips: 24800, avatar: "B", streak: 14 },
  { rank: 2, name: "tiago.ims", tips: 19450, avatar: "T", streak: 7 },
  { rank: 3, name: "carolina.r", tips: 15200, avatar: "C", streak: 3 },
  { rank: 4, name: "joao.m", tips: 12300, avatar: "J", streak: 21 },
  { rank: 5, name: "sofia.nova", tips: 9800, avatar: "S", streak: 5 },
];

const TICKER = [
  "João T. colocou 300 TIPS em Pedro S. chegar atrasado 💀",
  "Ana P. ganhou 1,200 TIPS no Party Animal 🏆",
  "Rui S. está em all-in com 5,000 TIPS 💎",
  "beatriz.mf continua invicta — 14 wins seguidos 🔥",
  "Novo bet: 'Quem sai primeiro do exame?' ⏰",
  "Carolina R. comentou: 'Óbvio que over 100.5' 😂",
];

function AnimatedCounter({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

function OddsFlash({ odds }) {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setFlash(true);
      setTimeout(() => setFlash(false), 300);
    }, 3000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span style={{
      fontFamily: "'Space Mono', monospace",
      fontWeight: 700,
      fontSize: 14,
      color: flash ? "#00ff87" : "#c8ff00",
      transition: "color 0.3s ease",
      letterSpacing: "-0.5px",
    }}>
      {odds.toFixed(2)}x
    </span>
  );
}

function BetCard({ bet, onSelect }) {
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(100);
  const isFeatured = bet.featured;

  return (
    <div
      onClick={() => onSelect(bet)}
      style={{
        background: isFeatured
          ? "linear-gradient(135deg, rgba(0,255,135,0.08) 0%, rgba(0,180,255,0.06) 100%)"
          : "rgba(255,255,255,0.03)",
        border: isFeatured ? "1px solid rgba(0,255,135,0.3)" : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "18px 20px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(0,255,135,0.25)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = isFeatured ? "rgba(0,255,135,0.3)" : "rgba(255,255,255,0.07)"; }}
    >
      {isFeatured && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          background: "linear-gradient(135deg, #00ff87, #00b4ff)",
          color: "#000", fontSize: 9, fontWeight: 800,
          padding: "4px 12px", borderRadius: "0 16px 0 10px",
          letterSpacing: 1, textTransform: "uppercase",
        }}>★ FEATURED</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1,
              color: "#888", textTransform: "uppercase",
            }}>{bet.categoryEmoji} {bet.category}</span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 20, padding: "2px 8px",
              color: "#aaa",
            }}>{bet.tag}</span>
          </div>
          <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
            {bet.title}
          </h3>
          <p style={{ color: "#888", fontSize: 12, margin: "4px 0 0", lineHeight: 1.4 }}>
            {bet.description}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {bet.options.map((opt, i) => (
          <button
            key={i}
            onClick={e => { e.stopPropagation(); setSelected(i); }}
            style={{
              flex: 1, minWidth: 80,
              background: selected === i ? "rgba(0,255,135,0.15)" : "rgba(255,255,255,0.05)",
              border: selected === i ? "1px solid rgba(0,255,135,0.6)" : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "8px 10px",
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <span style={{ fontSize: 11, color: selected === i ? "#00ff87" : "#aaa", fontWeight: 600 }}>
              {opt.label}
            </span>
            <OddsFlash odds={opt.odds} />
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Volume</span>
            <span style={{ fontSize: 13, color: "#c8ff00", fontWeight: 700, fontFamily: "monospace" }}>
              {(bet.volume / 1000).toFixed(1)}k TIPS
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Players</span>
            <span style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>{bet.participants}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Closes</span>
            <span style={{ fontSize: 13, color: bet.closesIn.includes('m') && !bet.closesIn.includes('d') ? "#ff6b6b" : "#aaa", fontWeight: 700 }}>
              {bet.closesIn}
            </span>
          </div>
        </div>
        {bet.trending && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: "rgba(255,107,107,0.15)",
            border: "1px solid rgba(255,107,107,0.3)",
            color: "#ff6b6b", borderRadius: 20, padding: "3px 10px",
            letterSpacing: 0.5,
          }}>📈 TRENDING</span>
        )}
      </div>
    </div>
  );
}

export default function NovatipsHomepage() {
  const [tickerIndex, setTickerIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedBet, setSelectedBet] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setTickerIndex(i => (i + 1) % TICKER.length), 3500);
    return () => clearInterval(t);
  }, []);

  const filters = ["All", "🔥 Hot", "⏰ Closing", "Campus", "Social", "Awards"];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: "#fff",
    }}>
      {/* Live ticker */}
      <div style={{
        background: "rgba(0,255,135,0.08)",
        borderBottom: "1px solid rgba(0,255,135,0.15)",
        padding: "8px 24px",
        display: "flex", alignItems: "center", gap: 12,
        overflow: "hidden",
      }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 2,
          color: "#00ff87", textTransform: "uppercase",
          background: "rgba(0,255,135,0.15)",
          padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap",
        }}>● LIVE</span>
        <span style={{
          fontSize: 12, color: "#aaa",
          transition: "opacity 0.5s",
          whiteSpace: "nowrap",
        }}>
          {TICKER[tickerIndex]}
        </span>
      </div>

      {/* Navbar */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(10px)",
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,15,0.85)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #00ff87, #00b4ff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 14, color: "#000",
          }}>N</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5, fontFamily: "'Space Grotesk', sans-serif" }}>
              NOVA <span style={{ background: "linear-gradient(90deg, #00ff87, #00b4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>TIPS</span>
            </div>
            <div style={{ fontSize: 9, color: "#555", letterSpacing: 1.5, textTransform: "uppercase", marginTop: -2 }}>
              For entertainment only · No real money
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#666" }}>
          {["Bets", "Leaderboard", "Profile"].map(item => (
            <span key={item} style={{ cursor: "pointer", transition: "color 0.2s" }}
              onMouseEnter={e => e.target.style.color = "#fff"}
              onMouseLeave={e => e.target.style.color = "#666"}>{item}</span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(200,255,0,0.1)",
            border: "1px solid rgba(200,255,0,0.25)",
            borderRadius: 20, padding: "6px 14px",
          }}>
            <span style={{ fontSize: 12, color: "#c8ff00", fontWeight: 700, fontFamily: "monospace" }}>
              💰 <AnimatedCounter value={2340} duration={2000} /> TIPS
            </span>
          </div>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "linear-gradient(135deg, #00b4ff, #0066ff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>V</div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        padding: "48px 32px 32px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,255,135,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, padding: "6px 16px", marginBottom: 24,
            fontSize: 12, color: "#888",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff87", display: "inline-block" }} />
            Época de exames · 47 bets ativos agora
          </div>

          <h1 style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 900, lineHeight: 1.05,
            margin: "0 0 16px",
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: -2,
          }}>
            Put your{" "}
            <span style={{
              background: "linear-gradient(90deg, #00ff87, #c8ff00)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>TIPS</span>
            <br />where your mouth is.
          </h1>

          <p style={{ fontSize: 16, color: "#666", maxWidth: 440, margin: "0 auto 32px", lineHeight: 1.6 }}>
            A plataforma de previsões da NOVA IMS. Virtual. Grátis. Completamente ridículo.{" "}
            <span style={{ color: "#00ff87" }}>100% for entertainment only.</span>
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={{
              background: "linear-gradient(135deg, #00ff87, #00b4ff)",
              color: "#000", fontWeight: 800, fontSize: 14,
              border: "none", borderRadius: 12, padding: "14px 28px",
              cursor: "pointer", letterSpacing: 0.5,
            }}>
              Entrar com @novaims 🎓
            </button>
            <button style={{
              background: "transparent",
              color: "#fff", fontWeight: 600, fontSize: 14,
              border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "14px 28px",
              cursor: "pointer",
            }}>
              Ver leaderboard →
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 32, justifyContent: "center", marginTop: 40 }}>
            {[
              { label: "Utilizadores", value: 847 },
              { label: "TIPS em jogo", value: 2140000 },
              { label: "Bets ativos", value: 47 },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", color: "#fff" }}>
                  <AnimatedCounter value={s.value} duration={2500} />
                  {s.label === "TIPS em jogo" && "M"}
                </div>
                <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 60px", display: "flex", gap: 24 }}>

        {/* Bets column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
            {filters.map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} style={{
                whiteSpace: "nowrap",
                background: activeFilter === f ? "rgba(0,255,135,0.15)" : "rgba(255,255,255,0.04)",
                border: activeFilter === f ? "1px solid rgba(0,255,135,0.4)" : "1px solid rgba(255,255,255,0.07)",
                color: activeFilter === f ? "#00ff87" : "#888",
                borderRadius: 20, padding: "7px 16px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
              }}>{f}</button>
            ))}
          </div>

          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1.5 }}>
              🔥 Bets em destaque
            </span>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.06)" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {BETS.map(bet => (
              <BetCard key={bet.id} bet={bet} onSelect={setSelectedBet} />
            ))}
          </div>

          <div style={{
            textAlign: "center", marginTop: 24,
            fontSize: 13, color: "#555",
          }}>
            <span style={{ cursor: "pointer", borderBottom: "1px solid #333", paddingBottom: 2 }}>
              Ver todos os 47 bets →
            </span>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Leaderboard */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "18px 20px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}>
                🏆 Leaderboard
              </span>
              <span style={{ fontSize: 11, color: "#555", cursor: "pointer" }}>Ver tudo →</span>
            </div>
            {LEADERBOARD.map((user) => (
              <div key={user.rank} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0",
                borderBottom: user.rank < 5 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <span style={{
                  width: 20, fontSize: 12, fontWeight: 700, textAlign: "center",
                  color: user.rank === 1 ? "#ffd700" : user.rank === 2 ? "#c0c0c0" : user.rank === 3 ? "#cd7f32" : "#555",
                }}>
                  {user.rank === 1 ? "🥇" : user.rank === 2 ? "🥈" : user.rank === 3 ? "🥉" : `#${user.rank}`}
                </span>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `hsl(${user.rank * 60}, 60%, 40%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                }}>{user.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#555" }}>
                    🔥 {user.streak}d streak
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#c8ff00", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {(user.tips / 1000).toFixed(1)}k
                </div>
              </div>
            ))}
          </div>

          {/* Your wallet */}
          <div style={{
            background: "linear-gradient(135deg, rgba(0,255,135,0.07), rgba(0,180,255,0.05))",
            border: "1px solid rgba(0,255,135,0.2)",
            borderRadius: 16, padding: "18px 20px",
          }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              O teu saldo
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", color: "#c8ff00", letterSpacing: -1 }}>
              💰 <AnimatedCounter value={2340} duration={2000} />
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>TIPS disponíveis</div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button style={{
                flex: 1, background: "rgba(0,255,135,0.15)",
                border: "1px solid rgba(0,255,135,0.3)",
                color: "#00ff87", borderRadius: 10, padding: "8px 0",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>Claim diário</button>
              <button style={{
                flex: 1, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#aaa", borderRadius: 10, padding: "8px 0",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>Histórico</button>
            </div>
          </div>

          {/* Legal disclaimer */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, padding: "12px 14px",
          }}>
            <p style={{ fontSize: 10, color: "#444", lineHeight: 1.6, margin: 0, textAlign: "center" }}>
              ⚠️ FOR ENTERTAINMENT PURPOSES ONLY<br />
              NO REAL MONEY INVOLVED<br />
              ALL CURRENCY IS VIRTUAL<br />
              NOVA TIPS is not a gambling platform.
            </p>
          </div>
        </div>
      </div>

      {/* Bet slip modal */}
      {selectedBet && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.75)", zIndex: 200,
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSelectedBet(null)}
        >
          <div
            style={{
              background: "#141418",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "20px 20px 0 0",
              padding: "24px 24px 40px",
              width: "100%", maxWidth: 480,
              animation: "slideUp 0.3s ease",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: "#333", borderRadius: 2, margin: "0 auto 20px" }} />
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, margin: "0 0 4px" }}>
              {selectedBet.title}
            </h3>
            <p style={{ color: "#666", fontSize: 13, margin: "0 0 20px" }}>{selectedBet.description}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {selectedBet.options.map((opt, i) => (
                <button key={i} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: "14px 16px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: 600,
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,255,135,0.4)"; e.currentTarget.style.background = "rgba(0,255,135,0.07)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                >
                  <span>{opt.label}</span>
                  <span style={{ color: "#c8ff00", fontFamily: "monospace", fontWeight: 700 }}>{opt.odds.toFixed(2)}x</span>
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#555", textAlign: "center" }}>
              Seleciona uma opção para continuar → entra com a tua conta @novaims
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;900&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 4px; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
