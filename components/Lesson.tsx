'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { NoteMd, MdToolbar, mdKeyDown } from './NoteMd';
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

type Mode = 'margin' | 'drawer' | 'mobile';
interface Editing { h: Highlight; dx: number; dy: number }
const GAP = 10;

export default function Lesson({ weekNumber, chapters, appendix = [] }: { weekNumber: number; chapters: LessonChapter[]; appendix?: AppendixEntry[] }) {
  const parsed = useMemo(() => chapters.map((c) => ({
    ...c,
    blocks: withAppendix(parseBlocks(c.content, c.blocks), appendix.filter((e) => e.chapter === c.number)),
  })), [chapters, appendix]);
  const [hls, setHls] = useState<Highlight[]>([]);
  const [tool, setTool] = useState<{ x: number; y: number } | null>(null);
  const pending = useRef<{ chapter: number; unit: number; start: number; end: number; text: string } | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  // ---- Google-Docs-style margin layer -------------------------------------------------
  const [mode, setMode] = useState<Mode>('margin');
  const [active, setActive] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState(false);
  const [pos, setPos] = useState<Record<string, number>>({});
  const [anchors, setAnchors] = useState<Record<string, number>>({});
  const [layer, setLayer] = useState<{ left: number; width: number; textRight: number } | null>(null);
  const [conn, setConn] = useState<{ x1: number; y1: number; x2: number; x3: number; y3: number } | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const edRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const m = () => setMode(window.innerWidth <= 960 ? 'mobile' : window.innerWidth < 1200 ? 'drawer' : 'margin');
    m();
    window.addEventListener('resize', m);
    return () => window.removeEventListener('resize', m);
  }, []);

  const relayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rr = root.getBoundingClientRect();
    const markOf = (id: string) => root.querySelector(`mark[data-hid="${id}"]`) as HTMLElement | null;
    const visible = (el: HTMLElement | null) => !!el && el.getClientRects().length > 0;
    const edId = editing?.h.id;
    const focus = edId ?? active;
    if (mode === 'margin') {
      const m = root.querySelector('.lesson .margin') as HTMLElement | null;
      if (m) {
        const mr = m.getBoundingClientRect();
        const nl = { left: mr.left - rr.left + 12, width: mr.width - 26, textRight: mr.left - rr.left };
        setLayer((o) => (o && o.left === nl.left && o.width === nl.width && o.textRight === nl.textRight ? o : nl));
      }
    }
    const items: { id: string; top: number; h: number }[] = [];
    const anc: Record<string, number> = {};
    const ids = hls.filter((h) => h.note || h.id === edId).map((h) => h.id);
    for (const id of ids) {
      const mk = markOf(id);
      if (!visible(mk)) continue;
      const top = mk!.getBoundingClientRect().top - rr.top - 4;
      anc[id] = top;
      const isEd = id === edId && editing && mode === 'margin';
      if (isEd && (editing!.dx || editing!.dy)) continue; // a dragged editor floats free
      const el = isEd ? edRef.current : cardRefs.current.get(id);
      items.push({ id, top, h: el ? el.offsetHeight : 60 });
    }
    items.sort((a, b) => a.top - b.top);
    const out: Record<string, number> = {};
    const k = items.findIndex((x) => x.id === focus);
    if (k >= 0) {
      out[items[k].id] = items[k].top;
      let bottom = items[k].top + items[k].h;
      for (let i = k + 1; i < items.length; i++) { const y = Math.max(items[i].top, bottom + GAP); out[items[i].id] = y; bottom = y + items[i].h; }
      let ceil = items[k].top;
      for (let i = k - 1; i >= 0; i--) { const y = Math.min(items[i].top, ceil - GAP - items[i].h); out[items[i].id] = y; ceil = y; }
    } else {
      let bottom = -Infinity;
      for (const it of items) { const y = Math.max(it.top, bottom + GAP); out[it.id] = y; bottom = y + it.h; }
    }
    setPos((o) => (JSON.stringify(o) === JSON.stringify(out) ? o : out));
    setAnchors((o) => (JSON.stringify(o) === JSON.stringify(anc) ? o : anc));
    // connector for the active pair
    let c: typeof conn = null;
    const mk = focus ? markOf(focus) : null;
    if (mode === 'margin' && focus && visible(mk) && out[focus] !== undefined) {
      const rects = mk!.getClientRects();
      const last = rects[rects.length - 1];
      const m = root.querySelector('.lesson .margin') as HTMLElement | null;
      const tr = m ? m.getBoundingClientRect().left - rr.left : last.right - rr.left + 20;
      c = { x1: last.right - rr.left + 2, y1: last.bottom - rr.top - 2, x2: tr, x3: tr + 12, y3: out[focus] + 16 };
    }
    setConn((o) => (JSON.stringify(o) === JSON.stringify(c) ? o : c));
  }, [hls, active, editing, mode]);

  useEffect(() => {
    const id = requestAnimationFrame(relayout);
    return () => cancelAnimationFrame(id);
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    const kick = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(relayout); };
    const ro = new ResizeObserver(kick);
    ro.observe(root);
    document.fonts?.ready.then(kick);
    root.addEventListener('toggle', kick, true);
    root.addEventListener('load', kick, true);
    window.addEventListener('resize', kick);
    return () => { ro.disconnect(); root.removeEventListener('toggle', kick, true); root.removeEventListener('load', kick, true); window.removeEventListener('resize', kick); cancelAnimationFrame(raf); };
  }, [relayout]);

  // emphasise the highlight belonging to the hovered / active note
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll('mark.hl-on, mark.hl-hover').forEach((m) => m.classList.remove('hl-on', 'hl-hover'));
    const on = editing?.h.id ?? active;
    if (on) root.querySelectorAll(`mark[data-hid="${on}"]`).forEach((m) => m.classList.add('hl-on'));
    if (hover) root.querySelectorAll(`mark[data-hid="${hover}"]`).forEach((m) => m.classList.add('hl-hover'));
  });

  // clicking empty page space deactivates the current note
  useEffect(() => {
    const off = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('mark.hl, .mnote, .note-ed, .seltool, .ndrawer, .ndrawer-tab')) return;
      if (!editing) setActive(null);
    };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [editing]);

  // editor: auto-grow textarea; on mobile keep the highlighted line visible above the sheet
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const max = mode === 'mobile' ? Math.round(window.innerHeight * 0.38) : 420;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight + 2, mode === 'mobile' ? 84 : 96), max)}px`;
    ta.style.overflowY = ta.scrollHeight + 2 > max ? 'auto' : 'hidden';
    if (mode === 'mobile' && editing && edRef.current) {
      const mk = rootRef.current?.querySelector(`mark[data-hid="${editing.h.id}"]`);
      if (mk) {
        const r = mk.getBoundingClientRect();
        const limit = window.innerHeight - edRef.current.offsetHeight - 16;
        if (r.bottom > limit) window.scrollBy({ top: r.bottom - limit });
        else if (r.top < 64) window.scrollBy({ top: r.top - 64 });
      }
    }
  }, [draft, editing, mode]);

  const startDrag = (e: React.PointerEvent) => {
    if (!editing || mode === 'mobile') return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ox = editing.dx, oy = editing.dy;
    const move = (ev: PointerEvent) => setEditing((ed) => (ed ? { ...ed, dx: ox + ev.clientX - sx, dy: oy + ev.clientY - sy } : ed));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

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
    if (withNote && at) { setDraft(''); setActive(h.id); setEditing({ h, dx: 0, dy: 0 }); }
    await fetch('/api/highlights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', highlight: h }) });
  };

  const edit = (h: Highlight) => { setDraft(h.note || ''); setActive(h.id); setEditing({ h, dx: 0, dy: 0 }); };
  // Clicking a highlight: on desktop it activates its margin note (or opens the editor if it has none);
  // on tablet it opens the drawer at that note; on mobile it opens the bottom sheet.
  const open = (h: Highlight, _el: HTMLElement) => {
    if (mode === 'mobile' || !h.note) { edit(h); return; }
    if (mode === 'drawer') setDrawer(true);
    if (active === h.id && !editing) { edit(h); return; }
    setActive(h.id);
  };

  const saveNote = async () => {
    if (!editing) return;
    const { h } = editing;
    setHls((x) => x.map((y) => (y.id === h.id ? { ...y, note: draft } : y)));
    setEditing(null);
    setActive(draft.trim() ? h.id : null);
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
    setActive(null);
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
                const cell = (x: U, cls = '') => (
                  <span className={`unit-in ${cls}`} data-unit={x.unit} data-chapter={c.number}>
                    {renderUnit(x.raw, hls.filter((h) => h.chapterNumber === c.number && h.unit === x.unit), open)}
                  </span>
                );
                return (
                  <div className="u-row" key={`b${i}`}>
                    <div className="text" style={{ paddingTop: 2, paddingBottom: 6 }}>{renderBlock(b.block, cell)}</div>
                    <div className="margin" style={{ padding: 0 }} />
                  </div>
                );
              }
              const mine = hls.filter((h) => h.chapterNumber === c.number && h.unit === b.unit);
              return (
                <div className="u-row" key={`u${b.unit}`}>
                  <div className="text" style={{ paddingTop: 0, paddingBottom: 0 }}>
                    <p className={`unit ${b.kind === 'li' ? 'li' : ''}`} data-unit={b.unit} data-chapter={c.number}>
                      {renderUnit(b.raw, mine, open)}
                    </p>
                  </div>
                  <div className="margin" style={{ padding: 0 }} />
                </div>
              );
  };

  const mdSet = (v: string, a: number, b: number) => {
    setDraft(v);
    requestAnimationFrame(() => { const t = taRef.current; if (t && document.activeElement !== t) { t.focus(); t.setSelectionRange(a, b); } });
  };
  const noted = hls.filter((h) => h.note);
  const isLong = (t: string) => t.length > 80 || t.split('\n').length > 4;
  const card = (h: Highlight, style?: React.CSSProperties) => {
    const on = active === h.id;
    const opened = on || expanded.has(h.id);
    return (
      <div
        key={h.id}
        ref={(el) => { if (el) cardRefs.current.set(h.id, el); else cardRefs.current.delete(h.id); }}
        className={`mnote sticky ${h.color} ${on ? 'on' : ''} ${opened ? 'open' : ''}`}
        style={style}
        data-nid={h.id}
        onMouseEnter={() => setHover(h.id)}
        onMouseLeave={() => setHover(null)}
        onClick={() => {
          if (on) { edit(h); return; }
          setActive(h.id);
          if (mode === 'drawer') rootRef.current?.querySelector(`mark[data-hid="${h.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }}
      >
        <div className="q">{h.text}</div>
        <NoteMd className="txt" text={h.note || ''} />
        {isLong(h.note || '') && !opened && (
          <button className="more mono" onClick={(e) => { e.stopPropagation(); setExpanded((s) => new Set(s).add(h.id)); }}>more ↓</button>
        )}
        {on && <span className="ed-hint mono">✎ 點一下編輯</span>}
      </div>
    );
  };

  const edBase = editing ? anchors[editing.h.id] : undefined;
  const edPlaced = editing && mode === 'margin' && layer && edBase !== undefined;
  const edStyle: React.CSSProperties | undefined = !editing || mode === 'mobile'
    ? undefined
    : edPlaced
      ? { position: 'absolute', left: layer!.left + layer!.width + 12 - 300 + editing.dx, top: (editing.dx || editing.dy ? edBase! : pos[editing.h.id] ?? edBase!) + editing.dy }
      : { position: 'fixed', right: 24 - editing.dx, top: 120 + editing.dy };

  return (
    <div ref={rootRef} className={`lesson-root mode-${mode}`} style={{ position: 'relative' }}>
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

      {/* margin layer: notes float beside their highlight and never change text layout */}
      {mode === 'margin' && layer && (
        <div className="mlayer" aria-label="頁邊筆記">
          {conn && (
            <svg className="mconn" aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible' }}>
              <path d={`M${conn.x1} ${conn.y1} H${conn.x2} L${conn.x3} ${conn.y3} H${layer.left}`} />
            </svg>
          )}
          {noted.filter((h) => !(editing && editing.h.id === h.id)).map((h) => card(h, {
            position: 'absolute', left: layer.left, width: layer.width, top: pos[h.id] ?? 0,
            visibility: pos[h.id] === undefined ? 'hidden' : 'visible',
          }))}
        </div>
      )}

      {/* tablet: notes live in a collapsible side drawer */}
      {mode === 'drawer' && noted.length > 0 && (
        <>
          <button className={`ndrawer-tab mono ${drawer ? "open" : ""}`} onClick={() => setDrawer((d) => !d)} aria-expanded={drawer}>
            {drawer ? "收合 ›" : `‹ 筆記 ${noted.length}`}
          </button>
          {drawer && (
            <aside className="ndrawer" aria-label="筆記抽屜">
              <div className="mono small muted" style={{ marginBottom: 10 }}>NOTES ✎ · {noted.length}</div>
              {[...noted].sort((a, b) => (anchors[a.id] ?? 1e9) - (anchors[b.id] ?? 1e9)).map((h) => card(h))}
            </aside>
          )}
        </>
      )}

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
        <div ref={edRef} className={`note-pop note-ed ${mode === 'mobile' ? 'sheet' : ''}`} style={edStyle} role="dialog" aria-label="筆記">
          <div className="ed-handle" onPointerDown={startDrag} title="拖曳移動">
            {mode !== 'mobile' && <span className="grip" aria-hidden>⠿</span>}
            <span className="q mono small muted">「{editing.h.text}」</span>
          </div>
          <MdToolbar get={() => taRef.current} set={mdSet} />
          <textarea
            ref={taRef}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (mdKeyDown(e, mdSet)) return;
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveNote(); }
              if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
            }}
            placeholder="在頁邊寫下想法…（⌘/Ctrl+Enter 儲存，Esc 取消）"
          />
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
