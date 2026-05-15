export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid #e5e7eb',
      padding: '32px',
      textAlign: 'center',
      background: '#ffffff'
    }}>
      <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.8 }}>
        <strong style={{ color: '#475569' }}>⚠️ FOR ENTERTAINMENT PURPOSES ONLY</strong><br />
        NO REAL MONEY INVOLVED · ALL CURRENCY IS VIRTUAL · NOVA TIPS IS NOT A GAMBLING PLATFORM<br />
        <span style={{ color: '#94a3b8' }}>© {new Date().getFullYear()} NOVA TIPS · NOVA IMS</span>
      </div>
    </footer>
  );
}
