'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import week1 from '@/content/weeks/week-01.json';
import week2 from '@/content/weeks/week-02.json';

const WEEKS: Record<number, { readings: { id: string; title: string }[]; exercises?: { id: string; question: string }[]; discussionQuestions: { id: string; question: string }[]; homework: { id: string; task: string }[] }> = { 1: week1, 2: week2 };

interface Highlight {
  id: string;
  weekNumber: number;
  text: string;
  color: string;
  note?: string;
  createdAt: number;
}

interface ReadingNote {
  id: string;
  weekNumber: number;
  readingId: string;
  note: string;
  createdAt: number;
}

interface Answer {
  id: string;
  weekNumber: number;
  itemId: string;
  itemType: 'discussion' | 'homework' | 'exercise';
  text: string;
  uploads?: string[];
  createdAt: number;
  updatedAt: number;
}

export default function NotebookPage() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [readingNotes, setReadingNotes] = useState<ReadingNote[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [highlightsRes, notesRes, answersRes] = await Promise.all([
        fetch('/api/highlights'),
        fetch('/api/notes'),
        fetch('/api/answers'),
      ]);

      if (highlightsRes.ok) {
        const data = await highlightsRes.json();
        setHighlights(data);
      }

      if (notesRes.ok) {
        const data = await notesRes.json();
        setReadingNotes(data);
      }

      if (answersRes.ok) {
        const data = await answersRes.json();
        setAnswers(data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportAsMarkdown = () => {
    let markdown = '# 我的學習筆記\n\n';
    markdown += `匯出時間：${new Date().toLocaleString('zh-TW')}\n\n`;

    const weekNumbers = Array.from(
      new Set([
        ...highlights.map((h) => h.weekNumber),
        ...readingNotes.map((n) => n.weekNumber),
        ...answers.map((a) => a.weekNumber),
      ])
    ).sort((a, b) => a - b);

    weekNumbers.forEach((weekNumber) => {
      markdown += `## Week ${weekNumber}\n\n`;

      const weekHighlights = highlights.filter((h) => h.weekNumber === weekNumber);
      if (weekHighlights.length > 0) {
        markdown += `### 劃線與筆記\n\n`;
        weekHighlights.forEach((h) => {
          markdown += `> ${h.text}\n\n`;
          if (h.note) {
            markdown += `**筆記：** ${h.note}\n\n`;
          }
        });
      }

      const weekReadingNotes = readingNotes.filter((n) => n.weekNumber === weekNumber);
      if (weekReadingNotes.length > 0) {
        markdown += `### 閱讀筆記\n\n`;
        weekReadingNotes.forEach((n) => {
          markdown += `- ${n.note}\n\n`;
        });
      }

      const weekAnswers = answers.filter((a) => a.weekNumber === weekNumber);
      if (weekAnswers.length > 0) {
        markdown += `### 討論與作業\n\n`;
        weekAnswers.forEach((a) => {
          const type = a.itemType === 'discussion' ? '討論' : a.itemType === 'exercise' ? '練習' : '作業';
          markdown += `**[${type}]**\n\n${a.text}\n\n`;
          if (a.uploads && a.uploads.length > 0) {
            markdown += `附件：\n`;
            a.uploads.forEach((url, idx) => {
              markdown += `- [附件 ${idx + 1}](${url})\n`;
            });
            markdown += '\n';
          }
        });
      }

      markdown += '\n---\n\n';
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `學習筆記_${new Date().toISOString().split('T')[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const COLOR: Record<string, string> = { yellow: '#f5d84a', blue: '#6cc0ff', green: '#a9cc4b', orange: '#ffab3d' };
  const TYPE: Record<string, string> = { exercise: '閱讀問題與練習', discussion: '課堂討論', homework: '小作業' };
  const questionFor = (w: number, id: string) => {
    const wk = WEEKS[w];
    if (!wk) return id;
    const all = [...(wk.exercises || []), ...wk.discussionQuestions, ...wk.homework.map((h) => ({ id: h.id, question: h.task }))];
    return all.find((q) => q.id === id)?.question || id;
  };
  const readingTitle = (w: number, id: string) => WEEKS[w]?.readings.find((r) => r.id === id)?.title || id;

  const weeks = Array.from(new Set([...highlights, ...readingNotes, ...answers].map((x) => x.weekNumber))).sort((a, b) => a - b);

  return (
    <div className="wrap" style={{ maxWidth: 980 }}>
      <div className="folder">
        <div className="tabs"><span style={{ background: 'var(--t6)' }}>MY NOTES</span></div>
        <div className="body page" style={{ padding: '30px 36px' }}>
          <div className="rule" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="en" style={{ fontSize: 13 }}>Notebook — everything you wrote</div>
              <h1 style={{ fontSize: 30, margin: '8px 0 0' }}>我的筆記本</h1>
            </div>
            <button onClick={exportAsMarkdown} className="btn">⇩ 匯出 Markdown</button>
          </div>
        </div>
      </div>

      {loading && <p className="mono small muted" style={{ marginTop: 24 }}>LOADING…</p>}
      {!loading && weeks.length === 0 && (
        <div className="section-card" style={{ marginTop: 24 }}>
          <p style={{ margin: 0 }}>還沒有任何筆記。到 <Link href="/week/1">Week 01</Link> 選取文字開始劃線吧。</p>
        </div>
      )}

      {weeks.map((w) => {
        const hs = highlights.filter((h) => h.weekNumber === w);
        const ns = readingNotes.filter((n) => n.weekNumber === w && n.note);
        const as = answers.filter((a) => a.weekNumber === w && (a.text || a.uploads?.length));
        return (
          <div key={w}>
            <div className="tabhead"><span className="tab" style={{ ['--c' as string]: 'var(--yellow)' }}>WEEK {String(w).padStart(2, '0')}</span></div>
            <div className="section-card">
              <Link href={`/week/${w}`} className="mono small">打開 Week {String(w).padStart(2, '0')} →</Link>
              {hs.length > 0 && (<>
                <h3 className="kicker" style={{ marginTop: 18 }}>劃線與頁邊筆記 · {hs.length}</h3>
                {hs.map((h) => (
                  <div className="nb-item" key={h.id}>
                    <div className="nb-quote" style={{ ['--c' as string]: COLOR[h.color] || COLOR.yellow }}>{h.text}</div>
                    {h.note && <div className="hand" style={{ marginTop: 6, paddingLeft: 16 }}>✎ {h.note}</div>}
                  </div>
                ))}
              </>)}
              {ns.length > 0 && (<>
                <h3 className="kicker" style={{ marginTop: 22 }}>閱讀筆記 · {ns.length}</h3>
                {ns.map((n) => (
                  <div className="nb-item" key={n.id}>
                    <div className="mono small muted">{readingTitle(w, n.readingId)}</div>
                    <div className="hand" style={{ whiteSpace: 'pre-wrap' }}>{n.note}</div>
                  </div>
                ))}
              </>)}
              {as.length > 0 && (<>
                <h3 className="kicker" style={{ marginTop: 22 }}>回答 · {as.length}</h3>
                {as.map((a) => (
                  <div className="nb-item" key={a.id}>
                    <div className="mono small muted">{TYPE[a.itemType]}</div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{questionFor(w, a.itemId)}</div>
                    <div className="hand" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{a.text}</div>
                    {a.uploads && a.uploads.length > 0 && (
                      <div className="files" style={{ marginTop: 6 }}>
                        {a.uploads.map((u, k) => <a key={k} className="chip" href={u} target="_blank" rel="noopener noreferrer">📎 附件 {k + 1}</a>)}
                      </div>
                    )}
                  </div>
                ))}
              </>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
