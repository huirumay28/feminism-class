'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (response.ok) {
        // Full navigation so the new cookie is sent and no cached redirect is reused.
        window.location.assign('/');
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error === 'Invalid passcode' ? '密碼不正確' : data.error || '密碼不正確');
      }
    } catch {
      setError('發生錯誤,請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="card folder">
        <div className="tabs">
          <span style={{ background: 'var(--t1)' }}>01</span>
          <span style={{ background: 'var(--t5)' }}>02</span>
          <span style={{ background: 'var(--t7)' }}>03</span>
        </div>
        <form onSubmit={handleSubmit} className="body page" style={{ padding: '30px 28px' }}>
          <div className="rule" />
          <div className="en" style={{ fontSize: 13 }}>Study Notebook —<br />Private</div>
          <h1 style={{ fontSize: 24, margin: '14px 0 16px' }}>台灣女性主義與公益實務</h1>
          <label htmlFor="passcode" className="mono small">PASSCODE · 課程密碼</label>
          <input
            type="password"
            id="passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="••••"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={loading}
            style={{ marginTop: 6 }}
          />
          {error && <p className="small" style={{ color: '#c0392b', margin: '8px 0 0' }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
            {loading ? '驗證中…' : '打開筆記本 →'}
          </button>
        </form>
      </div>
    </div>
  );
}
