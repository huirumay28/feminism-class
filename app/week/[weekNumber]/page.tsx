import week01 from '@/content/weeks/week-01.json';
import week02 from '@/content/weeks/week-02.json';
import appendixData from '@/content/appendix.json';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Lesson, { type LessonChapter, type Figure, type AppendixEntry } from '@/components/Lesson';
import ReadingChecklist from '@/components/ReadingChecklist';
import AnswerBox from '@/components/AnswerBox';
import { Chart, type ContentBlock } from '@/components/Blocks';

interface Reading { id: string; title: string; url: string | null; source: string; description: string; estimatedTime: string; required?: boolean }
interface WeekData {
  weekNumber: number; title: string; subtitle: string; period: string; introduction: string; learningGoals: string[];
  chapters: { number: number; title: string; content: string; figures?: Figure[]; blocks?: ContentBlock[] }[];
  readingsBlocks?: ContentBlock[];
  readings: Reading[]; exercises?: { id: string; question: string }[];
  discussionQuestions: { id: string; question: string }[]; homework: { id: string; task: string }[]; nextWeekPreview: string;
}

const C = ['var(--t1)', 'var(--t2)', 'var(--t3)', 'var(--t4)', 'var(--t5)', 'var(--t6)', 'var(--t7)', 'var(--t8)', 'var(--yellow)'];

const WEEKS: Record<string, WeekData> = { '1': week01 as unknown as WeekData, '2': week02 as unknown as WeekData };

export function generateStaticParams() {
  return Object.keys(WEEKS).map((weekNumber) => ({ weekNumber }));
}

export default async function WeekPage({ params }: { params: Promise<{ weekNumber: string }> }) {
  const { weekNumber } = await params;
  const w = WEEKS[String(Number(weekNumber))];
  if (!w) notFound();

  const chapters: LessonChapter[] = [
    { number: 0, title: '導言', content: w.introduction, tab: 'intro', color: C[0] },
    ...w.chapters.map((c, i) => ({ ...c, tab: `ch-${c.number}`, color: C[(i + 1) % C.length] })),
  ];
  const n = chapters.length;
  const toc = [
    ...chapters.map((c, i) => ({ id: c.tab!, label: c.number === 0 ? '導言 · 學習目標' : c.title, color: C[i % C.length] })),
    { id: 'readings', label: '本週閱讀', color: C[n % C.length] },
    ...(w.exercises?.length ? [{ id: 'exercises', label: '閱讀問題與練習', color: C[(n + 1) % C.length] }] : []),
    { id: 'seminar', label: '課堂討論', color: C[(n + 2) % C.length] },
    ...(w.homework.length ? [{ id: 'homework', label: '小作業', color: C[(n + 3) % C.length] }] : []),
  ];
  const num = (i: number) => String(i).padStart(2, '0');

  return (
    <div className="wrap">
      <div className="week-grid">
        <aside className="toc" aria-label="章節">
          {toc.map((t, i) => (
            <a key={t.id} href={`#${t.id}`} style={{ ['--c' as string]: t.color }}>
              <span>{num(i)}</span><span>{t.label}</span>
            </a>
          ))}
          <Link href="/notebook" className="btn" style={{ marginTop: 8, justifyContent: 'center' }}>我的筆記 →</Link>
        </aside>

        <div>
          <div className="page" style={{ borderBottom: 0 }}>
            <div className="cover-head">
              <div className="meta">
                <span className="chip on">WEEK {num(w.weekNumber)}</span>
                <span className="chip">{w.period}</span>
                <span className="chip">≤ 120 MIN</span>
              </div>
              <h1>{w.title}</h1>
              <div className="mono small muted">{w.subtitle}</div>
              <p className="hand small" style={{ margin: '14px 0 0', color: 'var(--ink-2)' }}>
                ✎ 選取任何文字即可劃線或在頁邊寫筆記。
              </p>
            </div>
          </div>
          <div className="page">
            <Lesson weekNumber={w.weekNumber} chapters={chapters} appendix={(appendixData.entries as AppendixEntry[]).filter((e) => e.week === w.weekNumber)} />
          </div>

          <div className="tabhead" style={{ marginTop: 28 }}><span className="tab" style={{ ['--c' as string]: C[0] }}>{num(0)} · 學習目標</span></div>
          <div className="section-card">
            <ol className="goals">{w.learningGoals.map((g, i) => <li key={i}>{g}</li>)}</ol>
          </div>

          <div className="tabhead" id="readings"><span className="tab" style={{ ['--c' as string]: toc[n].color }}>{num(n)} · READINGS</span></div>
          <div className="section-card">
            <h2>本週閱讀</h2>
            {w.readingsBlocks?.map((b, i) => (b.type === 'chart' ? <Chart key={i} b={b} /> : null))}
            <ReadingChecklist readings={w.readings} weekNumber={w.weekNumber} />
          </div>

          {w.exercises && w.exercises.length > 0 && (
            <>
              <div className="tabhead" id="exercises"><span className="tab" style={{ ['--c' as string]: toc[n + 1].color }}>{num(n + 1)} · WORKSHEET</span></div>
              <div className="section-card">
                <h2>閱讀問題與練習</h2>
                <p className="muted small" style={{ marginTop: 0 }}>每題都可以直接寫在橫線上,也可以上傳照片或檔案。自動儲存。</p>
                <AnswerBox items={w.exercises} weekNumber={w.weekNumber} itemType="exercise" color={toc[n + 1].color} />
              </div>
            </>
          )}

          <div className="tabhead" id="seminar"><span className="tab" style={{ ['--c' as string]: toc[n + 2].color }}>{num(n + 2)} · SEMINAR</span></div>
          <div className="section-card">
            <h2>課堂討論</h2>
            <p className="muted small" style={{ marginTop: 0 }}>選擇一題深入回答即可。</p>
            <AnswerBox items={w.discussionQuestions.map((q) => ({ ...q, question: q.question.replace('(選擇一題深入回答即可)', '') }))} weekNumber={w.weekNumber} itemType="discussion" color={toc[n + 2].color} />
          </div>

          {w.homework.length > 0 && (<>
          <div className="tabhead" id="homework"><span className="tab" style={{ ['--c' as string]: toc[n + 3].color }}>{num(n + 3)} · HOMEWORK</span></div>
          <div className="section-card">
            <h2>小作業</h2>
            <AnswerBox items={w.homework} weekNumber={w.weekNumber} itemType="homework" color={toc[n + 3].color} />
          </div>
          </>)}

          {w.nextWeekPreview && (
            <div className="section-card" style={{ marginTop: 28, background: 'var(--yellow)' }}>
              <div className="kicker" style={{ color: 'var(--ink)' }}>NEXT WEEK →</div>
              <p style={{ margin: '6px 0 0' }}>{w.nextWeekPreview}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
