'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { parseContentBlock, Chart, Icon, type ContentBlock, type ParsedBlock, type U } from './Blocks';

export interface Figure { src: string; caption: string; credit: string; creditUrl: string }
export interface LessonChapter { number: number; title: string; content: string; figures?: Figure[]; tab?: string; color?: string; blocks?: ContentBlock[] }

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

type Block = { kind: 'h'; text: string } | { kind: 'p' | 'li'; raw: string; plain: string; unit: number } | { kind: 'blk'; block: ParsedBlock; units: U[]; def: number }
  | { kind: 'app'; entry: AppendixEntry; inner: Block[] };

export interface AppendixEntry { id: string; week: number; chapter: number; after: string; question: string; source?: string; askedOn?: string; content: string; blocks?: ContentBlock[]; sources?: { name: string; url: string }[] }

const COLORS = ['yellow', 'blue', 'green', 'orange'] as const;

function parseBlocks(content: string, defs: ContentBlock[] = [], startUnit = 0): Block[] {
  const out: Block[] = [];
  let unit = startUnit;
  for (const block of content.split(/\n{2,}/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const ref = lines.length === 1 && lines[0].match(/^\[\[block:(\d+)\]\]$/);
    if (ref) {
      const def = defs[Number(ref[1])];
      if (def) out.push({ kind: 'blk', def: Number(ref[1]), ...parseContentBlock(def, () => unit++) });
      continue;
    }
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

function renderBlock(b: ParsedBlock, cell: (x: U, cls?: string) => React.ReactNode): React.ReactNode {
  switch (b.type) {
    case 'table':
      return (
        <figure className="blk blk-table">
          {b.caption && <figcaption className="mono small">{b.caption}</figcaption>}
          <div className="tscroll">
            <table>
              <thead><tr>{b.columns.map((h, k) => <th key={k} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((x, ci) => (b.rowHeader && ci === 0
                      ? <th key={ci} scope="row">{cell(x)}</th>
                      : <td key={ci} data-label={b.columns[ci] || undefined}>{cell(x)}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      );
    case 'cards':
      return (
        <div className={`blk blk-cards${b.numbered ? ' numbered' : ''}`} style={{ ['--cols' as string]: b.columns ?? b.items.length }}>
          {b.items.map((it, k) => (
            <div className="blk-card" key={k}>
              <div className="blk-card-head">
                {it.icon && <Icon name={it.icon} />}
                {b.numbered && <span className="blk-num mono">{String(k + 1).padStart(2, '0')}</span>}
                <div>
                  <div className="blk-card-title">{cell(it.title)}</div>
                  {it.subtitle && <div className="mono small muted">{it.subtitle}</div>}
                </div>
              </div>
              <p>{cell(it.text)}</p>
              {it.example && <p className="blk-ex"><span className="mono small">例 · </span>{cell(it.example)}</p>}
            </div>
          ))}
        </div>
      );
    case 'callout':
      return (
        <aside className={`blk blk-callout ${b.variant ?? 'key'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {b.image && <img src={b.image} alt={b.imageAlt ?? ''} loading="lazy" referrerPolicy="no-referrer" />}
          <div>
            {b.kicker && <div className="mono small blk-kicker">{b.kicker}</div>}
            {b.title && <div className="blk-callout-title">{cell(b.title)}</div>}
            <p>{cell(b.text)}</p>
            {b.credit && (b.creditUrl
              ? <a className="credit" href={b.creditUrl} target="_blank" rel="noopener noreferrer">資料來源:{b.credit} ↗</a>
              : <span className="credit">資料來源:{b.credit}</span>)}
          </div>
        </aside>
      );
    case 'timeline':
      return (
        <ol className={`blk blk-timeline${b.items.length > 3 ? ' vertical' : ''}`}>
          {b.items.map((it, k) => (
            <li key={k}>
              <span className="when mono">{it.when}</span>
              <div className="blk-tl-title">{cell(it.title)}</div>
              {it.text && <p>{cell(it.text)}</p>}
            </li>
          ))}
        </ol>
      );
    case 'chart':
      return <Chart b={b} />;
  }
}

function offsetWithin(unitEl: HTMLElement, node: Node, offset: number) {
  const r = document.createRange();
  r.setStart(unitEl, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** Insert appendix toggles after their anchor: "block:N", a paragraph's opening text, or "end". */
function withAppendix(blocks: Block[], entries: AppendixEntry[]): Block[] {
  const out = [...blocks];
  entries.forEach((e, k) => {
    const inner = parseBlocks(e.content, e.blocks, 10000 + k * 1000);
    const node: Block = { kind: 'app', entry: e, inner };
    let idx = -1;
    const m = e.after.match(/^block:(\d+)$/);
    if (m) idx = out.findIndex((b) => b.kind === 'blk' && b.def === Number(m[1]));
    else if (e.after !== 'end') idx = out.findIndex((b) => (b.kind === 'p' || b.kind === 'li') && b.plain.startsWith(e.after));
    // keep several toggles at the same spot in file order
    if (idx >= 0) { while (out[idx + 1]?.kind === 'app') idx++; out.splice(idx + 1, 0, node); } else out.push(node);
  });
  return out;
}

const flatUnits = (bs: Block[]): { unit: number; plain: string }[] =>
  bs.flatMap((b) => (b.kind === 'h' ? [] : b.kind === 'blk' ? b.units : b.kind === 'app' ? flatUnits(b.inner) : [b]));

export default function Lesson({ weekNumber, chapters, appendix = [] }: { weekNumber: number; chapters: LessonChapter[]; appendix?: AppendixEntry[] }) {
  const parsed = useMemo(() => chapters.map((c) => ({
    ...c,
    blocks: withAppendix(parseBlocks(c.content, c.blocks), appendix.filter((e) => e.chapter === c.number)),
  })), [chapters, appendix]);
  const [hls, setHls] = useState<Highlight[]>([]);
  const [tool, setTool] = useState<{ x: number; y: number } | null>(null);
  const pending = useRef<{ chapter: number; unit: number; start: number; end: number; text: string } | null>(null);
  const [editing, setEditing] = useState<{ h: Highlight; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Load + anchor legacy highlights (saved before paragraph anchors existed).
  // Deep links from the notebook (#app-<id>) open the toggle.
  useEffect(() => {
    const open1 = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id.startsWith('app-')) return;
      const d = document.getElementById(id) as HTMLDetailsElement | null;
      if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); }
    };
    open1();
    window.addEventListener('hashchange', open1);
    return () => window.removeEventListener('hashchange', open1);
  }, []);

  useEffect(() => {
    fetch('/api/highlights').then((r) => (r.ok ? r.json() : [])).then((all: Highlight[]) => {
      const unitsOf = (c: (typeof parsed)[number]) => flatUnits(c.blocks);
      const mine = all.filter((h) => h.weekNumber === weekNumber).map((h) => {
        // Keep the saved anchor if it still points at the same text.
        if (h.unit !== undefined) {
          const c = parsed.find((x) => x.number === h.chapterNumber);
          const u = c && unitsOf(c).find((x) => x.unit === h.unit);
          if (u && u.plain.slice(h.startOffset, h.endOffset) === h.text) return h;
        }
        // Otherwise (legacy, or content re-structured) re-anchor by text, same chapter first.
        const chs = [...parsed].sort((a, b) => Number(b.number === h.chapterNumber) - Number(a.number === h.chapterNumber));
        for (const c of chs) for (const u of unitsOf(c)) {
          const idx = u.plain.indexOf(h.text);
          if (idx >= 0) return { ...h, chapterNumber: c.number, unit: u.unit, startOffset: idx, endOffset: idx + h.text.length };
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

    const renderItem = (c: { number: number }, b: Block, i: number): React.ReactNode => {
              if (b.kind === 'app') {
                const e = b.entry;
                return (
                  <div className="u-row" key={`a${e.id}`}>
                    <div className="text app-wrap" style={{ paddingTop: 2, paddingBottom: 10 }}>
                      <details className="appx" id={`app-${e.id}`}>
                        <summary>
                          <span className="appx-tag mono">延伸問題 · 我的提問</span>
                          <span className="appx-q hand">{e.question}</span>
                          <span className="appx-chev mono" aria-hidden>＋</span>
                        </summary>
                        <div className="appx-body">
                          {b.inner.map((x, k) => renderItem(c, x, k))}
                          {(e.sources?.length || e.source) && (
                            <div className="appx-src mono small">
                              {e.sources?.length ? <>資料來源：{e.sources.map((s, k) => <a key={k} href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a>)}</> : null}
                              {e.source && <a href={e.source} target="_blank" rel="noopener noreferrer">原始對話 ChatGPT ↗</a>}
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                    <div className="margin" style={{ padding: 0 }} />
                  </div>
                );
              }
              if (b.kind === 'h') {
                return (
                  <div className="u-row" key={`h${i}`}>
                    <div className="text" style={{ paddingTop: 0, paddingBottom: 0 }}><h3><span className="zh">{b.text}</span></h3></div>
                    <div className="margin" style={{ padding: 0 }} />
                  </div>
                );
              }
              if (b.kind === 'blk') {
                const ids = new Set(b.units.map((x) => x.unit));
                const bn = hls.filter((h) => h.chapterNumber === c.number && h.unit !== undefined && ids.has(h.unit) && h.note);
                const cell = (x: U, cls = '') => (
                  <span className={`unit-in ${cls}`} data-unit={x.unit} data-chapter={c.number}>
                    {renderUnit(x.raw, hls.filter((h) => h.chapterNumber === c.number && h.unit === x.unit), open)}
                  </span>
                );
                return (
                  <div className="u-row" key={`b${i}`}>
                    <div className="text" style={{ paddingTop: 2, paddingBottom: 6 }}>{renderBlock(b.block, cell)}</div>
                    <div className="margin" style={{ paddingTop: 0, paddingBottom: 0 }}>
                      {bn.map((h) => (
                        <div key={h.id} className={`sticky ${h.color}`} onClick={(e) => open(h, e.currentTarget)}>
                          <div className="q">{h.text}</div>
                          {h.note}
                        </div>
                      ))}
                    </div>
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
            {c.blocks.map((b, i) => renderItem(c, b, i))}
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
