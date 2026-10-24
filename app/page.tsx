import Link from 'next/link';
import curriculum from '@/content/curriculum.json';

interface WeekTopic { week: number; title: string; status: 'available' | 'upcoming' }
interface Module { moduleNumber: number; title: string; weeks: string; description: string; learningGoal: string; weekTopics: WeekTopic[] }
interface Curriculum { currentWeek?: number; title: string; subtitle: string; duration: string; description: string; modules: Module[] }

const TABS = ['var(--t1)', 'var(--t2)', 'var(--t3)', 'var(--t4)', 'var(--t5)', 'var(--t6)'];


export default function Home() {
  const c = curriculum as unknown as Curriculum;
  const cur = c.currentWeek ?? 1;
  return (
    <div className="wrap">
      <div className="folder">
        <div className="tabs">
          {c.modules.map((m, i) => (
            <span key={m.moduleNumber} style={{ background: TABS[i % 6] }}>{String(m.moduleNumber).padStart(2, '0')}</span>
          ))}
        </div>
        <div className="body page">
          <div className="rule" />
          <div className="en">Taiwan Feminism &amp; Social Good:<br />A Study Notebook<br />—<br />Section 01 · History</div>
          <h1 style={{ marginTop: 22 }}>{c.title}</h1>
          <p style={{ margin: 0, maxWidth: 640 }}>{c.description}</p>
          <p className="mono small muted" style={{ marginTop: 10 }}>{c.duration} · 每週閱讀 ≤ 2 小時</p>
          <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/week/${cur}`} className="btn primary">本週 Week {String(cur).padStart(2, '0')} →</Link>
            {cur > 1 && <Link href="/week/1" className="btn">Week 01</Link>}
            <Link href="/notebook" className="btn">我的筆記</Link>
          </div>
          <div className="months">
            {c.modules.map((m, i) => (
              <div className="month" key={m.moduleNumber}>
                <span className="n" style={{ ['--c' as string]: TABS[i % 6] }}>MONTH {String(m.moduleNumber).padStart(2, '0')} · {m.weeks.replace('Weeks', 'WK')}</span>
                <h3>{m.title}</h3>
                <p>{m.learningGoal}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tabhead"><span className="tab" style={{ ['--c' as string]: 'var(--yellow)' }}>CONTENTS · 目錄</span></div>
      <div className="section-card">
        <table className="contents">
          <thead><tr><th>Week</th><th>主題</th><th>Month</th><th>Status</th></tr></thead>
          <tbody>
            {c.modules.flatMap((m) =>
              m.weekTopics.map((w) => (
                <tr key={w.week} className={w.status === 'available' ? 'avail' : ''}>
                  <td className="w">{String(w.week).padStart(2, '0')}</td>
                  <td>{w.status === 'available' ? <Link href={`/week/${w.week}`}>{w.title}</Link> : <span className="muted">{w.title}</span>}</td>
                  <td className="w">{String(m.moduleNumber).padStart(2, '0')}</td>
                  <td>{w.week === cur ? <span className="chip on">本週 NOW</span> : w.status === 'available' ? <span className="chip" style={{ background: 'var(--yellow)' }}>OPEN</span> : <span className="chip">SOON</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
