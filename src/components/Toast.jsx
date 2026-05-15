import { useEffect, useState } from 'react';

export default function Toast({ message, type = 'success' }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);

  const isError = type === 'error';
  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      background: '#ffffff',
      border: `1px solid ${isError ? '#fca5a5' : '#86efac'}`,
      borderRadius: 12, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      transform: visible ? 'translateY(0)' : 'translateY(-16px)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      maxWidth: 360,
    }}>
      <span style={{ fontSize: 18 }}>{isError ? '⚠️' : '✅'}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>{message}</span>
    </div>
  );
}
