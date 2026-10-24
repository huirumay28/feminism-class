'use client';
// Tiny, safe markdown for notes: stored as plain markdown text, rendered as React nodes (no HTML injection).
// Supports: line breaks, "- " bullets, "1. " numbered, "- [ ] " / "- [x] " checkboxes, 2-space indent levels,
// **bold**, *italic*. Plain-text notes render exactly as before (every line kept).
import React from 'react';

const LI = /^( *)(?:([-*•])|(\d+)[.)])\s(?:\[( |x|X)\]\s)?(.*)$/;

function inline(s: string, key = 0): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|(?<![*\w])\*(?!\s)(.+?)\*(?!\w)/g;
  let last = 0, m: RegExpExecArray | null, k = key;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(m[1] !== undefined ? <strong key={k++}>{inline(m[1], k * 10)}</strong> : <em key={k++}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function NoteMd({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const lines = (text || '').replace(/\r/g, '').split('\n');
  return (
    <div className={`md ${className || ''}`} style={style}>
      {lines.map((ln, i) => {
        const m = ln.match(LI);
        if (m) {
          const lvl = Math.floor(m[1].length / 2);
          const check = m[4];
          const mark = check !== undefined ? (check === ' ' ? '☐' : '☑') : m[3] ? `${m[3]}.` : '•';
          return (
            <div key={i} className={`md-li ${check && check !== ' ' ? 'done' : ''}`} style={{ paddingLeft: `${lvl * 1.3 + 1.3}em` }}>
              <span className="md-mk" aria-hidden>{mark}</span>{inline(m[5])}
            </div>
          );
        }
        const ind = ln.match(/^( +)/)?.[1].length || 0;
        return <div key={i} className="md-p" style={ind >= 2 ? { paddingLeft: `${Math.floor(ind / 2) * 1.3}em` } : undefined}>{ln.trim() ? inline(ln.trimStart()) : '\u00a0'}</div>;
      })}
    </div>
  );
}

// ---- editing helpers for a plain <textarea> holding markdown ----
type Set = (v: string, s: number, e: number) => void;
// Write to the DOM synchronously so the caret never jumps, then sync React state.
const wrap = (ta: HTMLTextAreaElement, set: Set): Set => (v, a, b) => { ta.value = v; ta.setSelectionRange(a, b); set(v, a, b); };
const lineStart = (v: string, i: number) => v.lastIndexOf('\n', i - 1) + 1;

export function mdApply(ta: HTMLTextAreaElement, set0: Set, cmd: 'ul' | 'ol' | 'task' | 'indent' | 'outdent' | 'bold' | 'italic') {
  const set = wrap(ta, set0);
  const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
  if (cmd === 'bold' || cmd === 'italic') {
    const w = cmd === 'bold' ? '**' : '*';
    set(v.slice(0, s) + w + v.slice(s, e) + w + v.slice(e), s + w.length, e + w.length);
    return;
  }
  const a = lineStart(v, s);
  let b = v.indexOf('\n', e === s ? e : e - 1); if (b < 0) b = v.length;
  const lines = v.slice(a, b).split('\n');
  let n = 0;
  const next = lines.map((l) => {
    if (cmd === 'indent') return '  ' + l;
    if (cmd === 'outdent') return l.replace(/^ {1,2}/, '');
    const ind = l.match(/^ */)![0];
    const body = l.slice(ind.length).replace(/^(?:[-*•]|\d+[.)])\s(?:\[[ xX]\]\s)?/, '');
    const had = l.slice(ind.length) !== body;
    const want = cmd === 'ul' ? '- ' : cmd === 'task' ? '- [ ] ' : `${++n}. `;
    const cur = l.slice(ind.length, l.length - body.length);
    return had && cur === want ? ind + body : ind + want + body; // toggle off if same kind
  });
  const out = next.join('\n');
  set(v.slice(0, a) + out + v.slice(b), lines.length === 1 ? Math.max(a, s + out.length - (b - a)) : a, a + out.length);
}

// Enter continues lists (empty item ends the list), Tab / Shift+Tab indent, Cmd/Ctrl+B / I.
export function mdKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>, set0: Set): boolean {
  const ta = ev.currentTarget;
  const set = wrap(ta, set0);
  const mod = ev.metaKey || ev.ctrlKey;
  if (mod && (ev.key === 'b' || ev.key === 'i')) { ev.preventDefault(); mdApply(ta, set, ev.key === 'b' ? 'bold' : 'italic'); return true; }
  if (ev.key === 'Tab') { ev.preventDefault(); mdApply(ta, set, ev.shiftKey ? 'outdent' : 'indent'); return true; }
  if (ev.key === 'Enter' && !mod && !ev.shiftKey && !ev.nativeEvent.isComposing) {
    const v = ta.value, s = ta.selectionStart;
    if (s !== ta.selectionEnd) return false;
    const a = lineStart(v, s);
    const m = v.slice(a, s).match(LI);
    if (!m) return false;
    ev.preventDefault();
    if (!m[5].trim() && s === (v.indexOf('\n', s) < 0 ? v.length : v.indexOf('\n', s))) { set(v.slice(0, a) + v.slice(s), a, a); return true; }
    const mk = m[3] ? `${Number(m[3]) + 1}. ` : `${m[2]} `;
    const ins = '\n' + m[1] + mk + (m[4] !== undefined ? '[ ] ' : '');
    set(v.slice(0, s) + ins + v.slice(s), s + ins.length, s + ins.length);
    return true;
  }
  return false;
}

export function MdToolbar({ get, set }: { get: () => HTMLTextAreaElement | null; set: Set }) {
  const b = (cmd: Parameters<typeof mdApply>[2], label: React.ReactNode, title: string) => (
    <button type="button" title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()}
      onClick={() => { const t = get(); if (t) mdApply(t, set, cmd); }}>{label}</button>
  );
  return (
    <div className="mdbar mono" role="toolbar" aria-label="格式">
      {b('ul', '•', '項目符號')}{b('ol', '1.', '編號清單')}{b('task', '☐', '待辦清單')}
      {b('outdent', '⇤', '減少縮排 (Shift+Tab)')}{b('indent', '⇥', '增加縮排 (Tab)')}
      {b('bold', <b>B</b>, '粗體 (⌘/Ctrl+B)')}{b('italic', <i>I</i>, '斜體 (⌘/Ctrl+I)')}
    </div>
  );
}
