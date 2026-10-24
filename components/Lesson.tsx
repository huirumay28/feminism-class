'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';

export interface Figure { src: string; caption: string; credit: string; creditUrl: string }
export interface LessonChapter { number: number; title: string; content: string; figures?: Figure[]; tab?: string; color?: string }

interface Highlight {
  id: string;
  weekNumber: number;
  text: string;
  color: string;
  startOffset: number;
  endOffset: number;
  chapterNumber?: number;
  unit?: number;
  note?: string;
  createdAt: number;
}

type Block = { kind: 'h'; text: string } | { kind: 'p' | 'li'; raw: string; plain: string; unit: number };

const COLORS = ['yellow', 'blue', 'green', 'orange'] as const;

function parseBlocks(content: string): Block[] {
  const out: Block[] = [];
  let unit = 0;
  for (const block of content.split(/\n{2,}/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.length === 1 && lines[0].startsWith('### ')) {
      out.push({ kind: 'h', text: lines[0].slice(4) });
      continue;
    }
    if (lines.every((l) => l.startsWith('- '))) {
      for (const l of lines) {
        const raw = l.slice(2);
        out.push({ kind: 'li', raw, plain: raw.replace(/\*\*/g, ''), unit: unit++ });
      }
      continue;
    }
    // paragraph: keep line breaks as spaces-free joins (CJK)
    const raw = lines.join('\n');
    out.push({ kind: 'p', raw, plain: raw.replace(/\*\*/g, ''), unit: unit++ });
  }
  return out;
}

/** Split raw (with **bold**) into runs, then cut runs at highlight boundaries. */
function renderUnit(raw: string, hls: Highlight[], onOpen: (h: Highlight, el: HTMLElement) => void) {
  const runs: { text: string; bold: boolean; start: number }[] = [];
  let pos = 0;
  raw.split('**').forEach((t, i) => {
    if (t) runs.push({ text: t, bold: i % 2 === 1, start: pos });
    pos += t.length;
  });
  const cuts = new Set<number>([0, pos]);
  runs.forEach((r) => { cuts.add(r.start); cuts.add(r.start + r.text.length); });
  hls.forEach((h) => { cuts.add(Math.max(0, h.startOffset)); cuts.add(Math.min(pos, h.endOffset)); });
  const points = [...cuts].sort((a, b) => a - b);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (a >= b) continue;
    const run = runs.find((r) => a >= r.start && a < r.start + r.text.length);
    if (!run) continue;
    const text = run.text.slice(a - run.start, b - run.start);
    let node: React.ReactNode = text;
    if (run.bold) node = <strong key={`s${a}`}>{node}</strong>;
    const h = hls.find((x) => a >= x.startOffset && b <= x.endOffset);
    if (h) {
      const isLast = b === Math.min(pos, h.endOffset);
      node = (
        <mark
          key={`m${a}`}
          className={`hl ${h.color}${h.note && isLast ? ' has-note' : ''}`}
          data-hid={h.id}
          onClick={(e) => { e.stopPropagation(); onOpen(h, e.currentTarget); }}
        >{node}</mark>
      );
    }
    nodes.push(<span key={`r${a}`}>{node}</span>);
  }
  return nodes;
}

function offsetWithin(unitEl: HTMLElement, node: Node, offset: number) {
  const r = document.createRange();
  r.setStart(unitEl, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

export default function Lesson({ weekNumber, chapters }: { weekNumber: number; chapters: LessonChapter[] }) {
  const parsed = useMemo(() => chapters.map((c) => ({ ...c, blocks: parseBlocks(c.content) })), [chapters]);
  const [hls, setHls] = useState<Highlight[]>([]);
  const [tool, setTool] = useState<{ x: number; y: number } | null>(null);
  const pending = useRef<{ chapter: number; unit: number; start: number; end: number; text: string } | null>(null);
  const [editing, setEditing] = useState<{ h: Highlight; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Load + anchor legacy highlights (saved before paragraph anchors existed).
  useEffect(() => {
    fetch('/api/highlights').then((r) => (r.ok ? r.json() : [])).then((all: Highlight[]) => {
      const mine = all.filter((h) => h.weekNumber === weekNumber).map((h) => {
        if (h.unit !== undefined) return h;
        const chs = parsed.filter((c) => h.chapterNumber === undefined || c.number === h.chapterNumber);
        for (const c of chs) for (const b of c.blocks) {
          if (b.kind === 'h') continue;
          const idx = b.plain.indexOf(h.text);
          if (idx >= 0) return { ...h, chapterNumber: c.number, unit: b.unit, startOffset: idx, endOffset: idx + h.text.length };
        }
        return h;
      });
      setHls(mine);
    }).catch(() => {});
  }, [weekNumber, parsed]);

  const readSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { pending.current = null; setTool(null); return; }
    const range = sel.getRangeAt(0);
    const startEl = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement) as HTMLElement | null;
    const unitEl = startEl?.closest('[data-unit]') as HTMLElement | null;
    if (!unitEl || !rootRef.current?.contains(unitEl)) { pending.current = null; setTool(null); return; }
    let start = offsetWithin(unitEl, range.startContainer, range.startOffset);
    let end = unitEl.contains(range.endContainer)
      ? offsetWithin(unitEl, range.endContainer, range.endOffset)
      : (unitEl.textContent || '').length; // clamp to the paragraph where selection began
    const full = unitEl.textContent || '';
    while (start < end && /\s/.test(full[start])) start++;
    while (end > start && /\s/.test(full[end - 1])) end--;
    if (end - start < 1) { pending.current = null; setTool(null); return; }
    pending.current = {
      chapter: Number(unitEl.dataset.chapter), unit: Number(unitEl.dataset.unit), start, end, text: full.slice(start, end),
    };
    const rect = range.getBoundingClientRect();
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const x = Math.min(Math.max(rect.left + rect.width / 2, 120), window.innerWidth - 120);
    setTool({ x, y: touch ? Math.min(rect.bottom + 14, window.innerHeight - 60) : Math.max(rect.top - 50, 56) });
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onChange = () => { clearTimeout(t); t = setTimeout(readSelection, 180); };
    document.addEventListener('selectionchange', onChange);
    document.addEventListener('mouseup', onChange);
    document.addEventListener('touchend', onChange);
    const hide = () => setTool(null);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      document.removeEventListener('selectionchange', onChange);
      document.removeEventListener('mouseup', onChange);
      document.removeEventListener('touchend', onChange);
      window.removeEventListener('scroll', hide);
    };
  }, [readSelection]);

  const create = async (color: string, withNote: boolean) => {
    const p = pending.current;
    if (!p) return;
    const h: Highlight = {
      id: nanoid(), weekNumber, text: p.text, color, startOffset: p.start, endOffset: p.end,
      chapterNumber: p.chapter, unit: p.unit, note: '', createdAt: Date.now(),
    };
    setHls((x) => [...x, h]);
    const at = tool;
    setTool(null);
    pending.current = null;
    window.getSelection()?.removeAllRanges();
    if (withNote && at) { setDraft(''); setEditing({ h, x: at.x, y: at.y }); }
    await fetch('/api/highlights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', highlight: h }) });
  };

  const open = (h: Highlight, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setDraft(h.note || '');
    setEditing({ h, x: r.left + r.width / 2, y: r.bottom + 8 });
  };

  const saveNote = async () => {
    if (!editing) return;
    const { h } = editing;
    setHls((x) => x.map((y) => (y.id === h.id ? { ...y, note: draft } : y)));
    setEditing(null);
    await fetch('/api/highlights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateNote', id: h.id, note: draft }) });
  };

  const recolor = async (color: string) => {
    if (!editing) return;
    const nh = { ...editing.h, color, note: draft };
    setHls((x) => x.map((y) => (y.id === nh.id ? nh : y)));
    setEditing({ ...editing, h: nh });
    await fetch('/api/highlights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: nh.id }) });
    await fetch('/api/highlights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', highlight: nh }) });
  };

  const remove = async () => {
    if (!editing) return;
    const id = editing.h.id;
    setHls((x) => x.filter((y) => y.id !== id));
    setEditing(null);
    await fetch('/api/highlights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
  };

  const popStyle = editing
    ? { left: Math.min(Math.max(editing.x - 150, 8), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 310), top: Math.min(editing.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 230) }
    : undefined;

  return (
    <div ref={rootRef}>
      {parsed.map((c) => (
        <section className="chapter" id={c.tab ?? `ch-${c.number}`} key={c.number}>
          <div className="lesson">
            <div className="u-row">
              <div className="text" style={{ paddingBottom: c.number > 0 ? 14 : 0 }}>
                {c.number > 0 && (
                  <>
                    <span className="chip" style={{ background: c.color, color: 'var(--ink)', fontSize: 11 }}>CH. {String(c.number).padStart(2, '0')}</span>
                    <h2 style={{ fontSize: 24, margin: '10px 0 0', lineHeight: 1.45 }}>{c.title}</h2>
                  </>
                )}
              </div>
              <div className="margin">{c.number > 0 && <span className="mono small muted">NOTES ✎</span>}</div>
            </div>
            {c.blocks.map((b, i) => {
              if (b.kind === 'h') {
                return (
                  <div className="u-row" key={`h${i}`}>
                    <div className="text" style={{ paddingTop: 0, paddingBottom: 0 }}><h3><span className="zh">{b.text}</span></h3></div>
                    <div className="margin" style={{ padding: 0 }} />
                  </div>
                );
              }
              const mine = hls.filter((h) => h.chapterNumber === c.number && h.unit === b.unit);
              const notes = mine.filter((h) => h.note);
              return (
                <div className="u-row" key={`u${b.unit}`}>
                  <div className="text" style={{ paddingTop: 0, paddingBottom: 0 }}>
                    <p className={`unit ${b.kind === 'li' ? 'li' : ''}`} data-unit={b.unit} data-chapter={c.number}>
                      {renderUnit(b.raw, mine, open)}
                    </p>
                  </div>
                  <div className="margin" style={{ paddingTop: 0, paddingBottom: 0 }}>
                    {notes.map((h) => (
                      <div key={h.id} className={`sticky ${h.color}`} onClick={(e) => open(h, e.currentTarget)}>
                        <div className="q">{h.text}</div>
                        {h.note}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {c.figures && c.figures.length > 0 && (
              <div className="u-row">
                <div className="text" style={{ paddingTop: 6 }}>
                  <div className="figs">
                    {c.figures.map((f, k) => (
                      <figure className="fig" key={k}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.src} alt={f.caption} loading="lazy" referrerPolicy="no-referrer" />
                        <figcaption>
                          <span className="mono small">FIG. {c.number}.{k + 1} — </span>{f.caption}
                          <a className="credit" href={f.creditUrl} target="_blank" rel="noopener noreferrer">圖片來源:{f.credit} ↗</a>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
                <div className="margin" />
              </div>
            )}
            <div className="u-row"><div className="text" style={{ padding: '0 0 18px' }} /><div className="margin" style={{ padding: 0 }} /></div>
          </div>
        </section>
      ))}

      {tool && (
        <div className="seltool" style={{ left: tool.x, top: tool.y }} onMouseDown={(e) => e.preventDefault()} role="toolbar" aria-label="劃線工具">
          {COLORS.map((c) => (
            <button key={c} className={`dot ${c}`} aria-label={`${c} 劃線`} onClick={() => create(c, false)} />
          ))}
          <span className="sep" />
          <button onClick={() => create('yellow', true)}>✎ 筆記</button>
        </div>
      )}

      {editing && (
        <div className="note-pop" style={popStyle} role="dialog" aria-label="筆記">
          <div className="q mono small muted" style={{ marginBottom: 6, maxHeight: 48, overflow: 'hidden' }}>「{editing.h.text}」</div>
          <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="在頁邊寫下想法…" />
          <div className="row">
            <div className="swatches">
              {COLORS.map((c) => (
                <button key={c} className={`swatch ${c} ${editing.h.color === c ? 'on' : ''}`} aria-label={c} onClick={() => recolor(c)} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={remove} style={{ padding: '3px 8px' }}>刪除</button>
              <button className="btn" onClick={() => setEditing(null)} style={{ padding: '3px 8px' }}>取消</button>
              <button className="btn primary" onClick={saveNote} style={{ padding: '3px 10px' }}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
