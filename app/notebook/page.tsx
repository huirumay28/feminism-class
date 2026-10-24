'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  itemType: 'discussion' | 'homework';
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
          const type = a.itemType === 'discussion' ? '討論' : '作業';
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center text-gray-600">載入中...</div>
      </div>
    );
  }

  const totalItems = highlights.length + readingNotes.length + answers.length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">我的筆記本</h1>
          <p className="text-gray-600">
            共 {totalItems} 筆記錄：{highlights.length} 個劃線、{readingNotes.length} 則閱讀筆記、
            {answers.length} 個回答
          </p>
        </div>
        <button
          onClick={exportAsMarkdown}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 text-sm"
          disabled={totalItems === 0}
        >
          匯出 Markdown
        </button>
      </header>

      {totalItems === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <p className="mb-4">還沒有任何筆記</p>
          <Link href="/" className="text-blue-600 hover:underline">
            開始學習 →
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {Array.from(
            new Set([
              ...highlights.map((h) => h.weekNumber),
              ...readingNotes.map((n) => n.weekNumber),
              ...answers.map((a) => a.weekNumber),
            ])
          )
            .sort((a, b) => a - b)
            .map((weekNumber) => (
              <section key={weekNumber} className="border-l-4 border-blue-600 pl-6">
                <h2 className="text-2xl font-semibold mb-6">
                  <Link href={`/week/${weekNumber}`} className="hover:underline">
                    Week {weekNumber}
                  </Link>
                </h2>

                {highlights.filter((h) => h.weekNumber === weekNumber).length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-4">劃線與筆記</h3>
                    <div className="space-y-3">
                      {highlights
                        .filter((h) => h.weekNumber === weekNumber)
                        .map((highlight) => (
                          <div
                            key={highlight.id}
                            className="p-4 rounded-lg bg-gray-50 border border-gray-200"
                          >
                            <p className="text-sm mb-2 italic">&ldquo;{highlight.text}&rdquo;</p>
                            {highlight.note && (
                              <p className="text-sm text-gray-600">{highlight.note}</p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {readingNotes.filter((n) => n.weekNumber === weekNumber).length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-4">閱讀筆記</h3>
                    <div className="space-y-3">
                      {readingNotes
                        .filter((n) => n.weekNumber === weekNumber)
                        .map((note) => (
                          <div
                            key={note.id}
                            className="p-4 rounded-lg bg-gray-50 border border-gray-200"
                          >
                            <p className="text-sm">{note.note}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {answers.filter((a) => a.weekNumber === weekNumber).length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-4">討論與作業</h3>
                    <div className="space-y-4">
                      {answers
                        .filter((a) => a.weekNumber === weekNumber)
                        .map((answer) => (
                          <div
                            key={answer.id}
                            className="p-4 rounded-lg bg-gray-50 border border-gray-200"
                          >
                            <div className="text-xs text-gray-600 mb-2">
                              {answer.itemType === 'discussion' ? '討論問題' : '作業'}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{answer.text}</p>
                            {answer.uploads && answer.uploads.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="text-xs text-gray-600 mb-2">附件：</div>
                                <div className="space-y-1">
                                  {answer.uploads.map((url, idx) => (
                                    <div key={idx}>
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline"
                                      >
                                        附件 {idx + 1}
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
