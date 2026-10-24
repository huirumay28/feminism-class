'use client';

import { useEffect, useRef, useState } from 'react';

interface Reading {
  id: string; title: string; url: string | null; source: string; description: string; estimatedTime: string; required?: boolean;
}

export default function ReadingChecklist({ readings, weekNumber }: { readings: Reading[]; weekNumber: number }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    Promise.all([fetch('/api/notes?type=checks'), fetch('/api/notes')]).then(async ([c, n]) => {
      if (c.ok) {
        const m: Record<string, boolean> = {};
        (await c.json()).filter((x: { weekNumber: number }) => x.weekNumber === weekNumber)
          .forEach((x: { readingId: string; checked: boolean }) => { m[x.readingId] = x.checked; });
        setChecks(m);
      }
      if (n.ok) {
        const m: Record<string, string> = {};
        (await n.json()).filter((x: { weekNumber: number }) => x.weekNumber === weekNumber)
          .forEach((x: { readingId: string; note: string }) => { m[x.readingId] = x.note; });
        setNotes(m);
      }
    }).catch(() => {});
  }, [weekNumber]);

  const toggle = (readingId: string) => {
    const checked = !checks[readingId];
    setChecks({ ...checks, [readingId]: checked });
    fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveCheck', check: { weekNumber, readingId, checked, checkedAt: checked ? Date.now() : undefined } }) });
  };

  const saveNote = (readingId: string, note: string) => {
    setNotes((x) => ({ ...x, [readingId]: note }));
    clearTimeout(timers.current[readingId]);
    timers.current[readingId] = setTimeout(() => {
      fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveNote', note: { id: `${weekNumber}-${readingId}`, weekNumber, readingId, note, createdAt: Date.now() } }) });
    }, 800);
  };

  const done = readings.filter((r) => checks[r.id]).length;

  return (
    <div>
      <div className="mono small muted" style={{ marginBottom: 4 }}>PROGRESS {done}/{readings.length}</div>
      {readings.map((r, i) => (
        <div className="reading" key={r.id}>
          <button className={`check ${checks[r.id] ? 'on' : ''}`} onClick={() => toggle(r.id)} aria-label={checks[r.id] ? '標為未讀' : '標為已讀'}>
            {checks[r.id] ? '✓' : ''}
          </button>
          <div>
            <div className="meta">
              <span className="chip">{String(i + 1).padStart(2, '0')}</span>
              <span className={`chip ${r.required === false ? '' : 'on'}`}>{r.required === false ? '選讀' : '必讀'}</span>
              <span className="chip">{r.estimatedTime}</span>
            </div>
            <h4>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a> : r.title}</h4>
            <div className="mono small muted">{r.source}</div>
            <p>{r.description}</p>
            <button className="btn" style={{ padding: '2px 10px', marginTop: 4 }} onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })}>
              {open[r.id] ? '收起筆記' : notes[r.id] ? '✎ 我的閱讀筆記' : '✎ 寫閱讀筆記'}
            </button>
            {open[r.id] && (
              <textarea className="ruled" style={{ marginTop: 8, border: '1px solid rgba(29,27,23,.3)', minHeight: 130 }}
                value={notes[r.id] || ''} onChange={(e) => saveNote(r.id, e.target.value)} placeholder="摘錄、疑問、想法…" />
            )}
            {!open[r.id] && notes[r.id] && <div className="hand" style={{ marginTop: 6, color: 'var(--ink-2)' }}>{notes[r.id].slice(0, 80)}{notes[r.id].length > 80 ? '…' : ''}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
