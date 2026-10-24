import type { ReactNode } from 'react';

/** A highlightable text cell inside a structured block. */
export interface U { raw: string; plain: string; unit: number }

export type ContentBlock =
  | { type: 'table'; caption?: string; columns: string[]; rows: string[][]; rowHeader?: boolean }
  | { type: 'cards'; columns?: number; numbered?: boolean; items: { title: string; subtitle?: string; text: string; example?: string; icon?: string }[] }
  | { type: 'callout'; variant?: 'person' | 'source' | 'key'; kicker?: string; title?: string; text: string; image?: string; imageAlt?: string; credit?: string; creditUrl?: string }
  | { type: 'timeline'; items: { when: string; title: string; text?: string }[] }
  | { type: 'chart'; chart: 'stacked' | 'bar'; title: string; total?: number; unit?: string; data: { label: string; value: number }[]; note?: string };

/** Same shapes with highlightable strings replaced by U. */
export type ParsedBlock =
  | { type: 'table'; caption?: string; columns: string[]; rows: U[][]; rowHeader?: boolean }
  | { type: 'cards'; columns?: number; numbered?: boolean; items: { title: U; subtitle?: string; text: U; example?: U; icon?: string }[] }
  | { type: 'callout'; variant?: string; kicker?: string; title?: U; text: U; image?: string; imageAlt?: string; credit?: string; creditUrl?: string }
  | { type: 'timeline'; items: { when: string; title: U; text?: U }[] }
  | Extract<ContentBlock, { type: 'chart' }>;

export function parseContentBlock(b: ContentBlock, next: () => number): { block: ParsedBlock; units: U[] } {
  const units: U[] = [];
  const u = (raw: string): U => { const x = { raw, plain: raw.replace(/\*\*/g, ''), unit: next() }; units.push(x); return x; };
  switch (b.type) {
    case 'table': return { block: { ...b, rows: b.rows.map((r) => r.map(u)) }, units };
    case 'cards': return { block: { ...b, items: b.items.map((it) => ({ ...it, title: u(it.title), text: u(it.text), example: it.example ? u(it.example) : undefined })) }, units };
    case 'callout': return { block: { ...b, title: b.title ? u(b.title) : undefined, text: u(b.text) }, units };
    case 'timeline': return { block: { ...b, items: b.items.map((it) => ({ when: it.when, title: u(it.title), text: it.text ? u(it.text) : undefined })) }, units };
    default: return { block: b, units };
  }
}

const ICONS: Record<string, ReactNode> = {
  book: <><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" /><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" /></>,
  chat: <><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" /><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  megaphone: <><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
};
export function Icon({ name }: { name: string }) {
  return <svg className="blk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[name]}</svg>;
}

const CHART_FILLS = ['var(--t2)', 'var(--t6)', 'var(--paper-2)', 'var(--t8)', 'var(--t1)'];

/** Notebook-styled SVG chart (no library). */
export function Chart({ b }: { b: Extract<ContentBlock, { type: 'chart' }> }) {
  const total = b.total ?? b.data.reduce((s, d) => s + d.value, 0);
  const unit = b.unit ?? '';
  if (b.chart === 'stacked') {
    let x = 0;
    return (
      <figure className="blk blk-chart">
        <div className="blk-chart-head"><span className="mono small">{b.title}</span><span className="mono small muted">上限 {total} {unit}</span></div>
        <svg viewBox="0 0 600 46" role="img" aria-label={`${b.title}：${b.data.map((d) => `${d.label} ${d.value}${unit}`).join('、')}`} preserveAspectRatio="none" className="blk-bar">
          {b.data.map((d, i) => {
            const w = (d.value / total) * 600;
            const r = <rect key={i} x={x} y={1} width={w} height={44} fill={CHART_FILLS[i % CHART_FILLS.length]} stroke="var(--ink)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
            x += w; return r;
          })}
        </svg>
        <ul className="blk-legend">
          {b.data.map((d, i) => (
            <li key={i}><span className="sw" style={{ background: CHART_FILLS[i % CHART_FILLS.length] }} />{d.label}<b>{d.value} {unit}</b><span className="muted mono small">{Math.round((d.value / total) * 100)}%</span></li>
          ))}
        </ul>
        {b.note && <figcaption className="small muted">{b.note}</figcaption>}
      </figure>
    );
  }
  const max = Math.max(...b.data.map((d) => d.value));
  return (
    <figure className="blk blk-chart">
      <div className="blk-chart-head"><span className="mono small">{b.title}</span></div>
      {b.data.map((d, i) => (
        <div className="hbar" key={i}><span>{d.label}</span><svg viewBox="0 0 100 14" preserveAspectRatio="none"><rect x={0} y={1} width={(d.value / max) * 100} height={12} fill={CHART_FILLS[i % CHART_FILLS.length]} stroke="var(--ink)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" /></svg><b>{d.value} {unit}</b></div>
      ))}
      {b.note && <figcaption className="small muted">{b.note}</figcaption>}
    </figure>
  );
}
