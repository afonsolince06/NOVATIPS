// Fallback bets shown when Supabase has no data yet.
// Source of truth is the Supabase `bets` table — keep this in sync.
export const INITIAL_BETS = [
  {
    id: 1,
    title: "Jolas no CVV",
    description: "Over 100.5 jolas dadas gratuitamente no próximo CVV",
    options: [
      { label: "Over 100.5", odds: 1.85 },
      { label: "Under 100.5", odds: 2.10 },
    ],
    closesIn: "2h 34m", trending: true, featured: true,
  },
  {
    id: 2,
    title: "Biblioteca Nap",
    description: "Quem adormece primeiro na biblioteca durante a época de exames?",
    options: [
      { label: "Miguel T.", odds: 2.10 },
      { label: "Carolina R.", odds: 3.50 },
      { label: "Pedro V.", odds: 4.00 },
    ],
    closesIn: "6d 2h", trending: false, featured: false,
  },
  // ── NOVA IMS Sports Tournament ──────────────────────────────────────────
  { id: 7,  title: "Autogolo do Henrique", description: "Nem os melhores escapam.",          options: [{ label: "Sim", odds: 1.70 }, { label: "Não", odds: 2.23 }], closesIn: "24h", trending: true,  featured: false },
  { id: 8,  title: "Jogo Feminino",        description: "O jogo com mais golos do torneio.", options: [{ label: "Sim", odds: 1.80 }, { label: "Não", odds: 2.07 }], closesIn: "24h", trending: true,  featured: false },
  { id: 9,  title: "Afonso Lince",         description: "10km percorridos.",                 options: [{ label: "Sim", odds: 1.50 }, { label: "Não", odds: 2.76 }], closesIn: "24h", trending: true,  featured: false },
  { id: 10, title: "Miguel Silva",         description: "A não partir a perna.",             options: [{ label: "Sim", odds: 4.50 }, { label: "Não", odds: 1.18 }], closesIn: "2h",  trending: false, featured: false },
  { id: 11, title: "Eduardo Nunes",        description: "A fazer um carrinho.",              options: [{ label: "Sim", odds: 1.20 }, { label: "Não", odds: 5.52 }], closesIn: "24h", trending: true,  featured: false },
  { id: 12, title: "Miguel Marques",       description: "MVP do torneio.",                   options: [{ label: "Sim", odds: 2.50 }, { label: "Não", odds: 1.53 }], closesIn: "24h", trending: true,  featured: false },
  { id: 13, title: "Carradas",             description: "O melhor guarda-redes do torneio.", options: [{ label: "Sim", odds: 2.00 }, { label: "Não", odds: 1.84 }], closesIn: "24h", trending: true,  featured: false },
  { id: 14, title: "Xicão",               description: "A fazer a celebração 67.",          options: [{ label: "Sim", odds: 1.15 }, { label: "Não", odds: 6.44 }], closesIn: "24h", trending: true,  featured: false },
];
