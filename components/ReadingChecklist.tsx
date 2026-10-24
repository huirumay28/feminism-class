'use client';

import { useState, useEffect } from 'react';

interface Reading {
  id: string;
  title: string;
  url: string | null;
  source: string;
  description: string;
  estimatedTime: string;
}

interface ReadingChecklistProps {
  readings: Reading[];
  weekNumber: number;
}

interface ReadingCheck {
  weekNumber: number;
  readingId: string;
  checked: boolean;
  checkedAt?: number;
}

interface ReadingNote {
  id: string;
  weekNumber: number;
  readingId: string;
  note: string;
  createdAt: number;
}

export default function ReadingChecklist({ readings, weekNumber }: ReadingChecklistProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  useEffect(() => {
    fetchChecksAndNotes();
  }, [weekNumber]);

  const fetchChecksAndNotes = async () => {
    try {
      const [checksRes, notesRes] = await Promise.all([
        fetch('/api/notes?type=checks'),
        fetch('/api/notes'),
      ]);

      if (checksRes.ok) {
        const checksData: ReadingCheck[] = await checksRes.json();
        const checksMap: Record<string, boolean> = {};
        checksData
          .filter((c) => c.weekNumber === weekNumber)
          .forEach((c) => {
            checksMap[c.readingId] = c.checked;
          });
        setChecks(checksMap);
      }

      if (notesRes.ok) {
        const notesData: ReadingNote[] = await notesRes.json();
        const notesMap: Record<string, string> = {};
        notesData
          .filter((n) => n.weekNumber === weekNumber)
          .forEach((n) => {
            notesMap[n.readingId] = n.note;
          });
        setNotes(notesMap);
      }
    } catch (error) {
      console.error('Failed to fetch checks and notes:', error);
    }
  };

  const toggleCheck = async (readingId: string) => {
    const newChecked = !checks[readingId];
    setChecks({ ...checks, [readingId]: newChecked });

    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveCheck',
          check: {
            weekNumber,
            readingId,
            checked: newChecked,
            checkedAt: newChecked ? Date.now() : undefined,
          },
        }),
      });
    } catch (error) {
      console.error('Failed to save check:', error);
    }
  };

  const saveNote = async (readingId: string, note: string) => {
    setNotes({ ...notes, [readingId]: note });

    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveNote',
          note: {
            id: `${weekNumber}-${readingId}`,
            weekNumber,
            readingId,
            note,
            createdAt: Date.now(),
          },
        }),
      });
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  return (
    <div className="space-y-4">
      {readings.map((reading) => (
        <div key={reading.id} className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={checks[reading.id] || false}
              onChange={() => toggleCheck(reading.id)}
              className="mt-1 w-5 h-5 rounded border-gray-200 text-blue-600 focus:ring-blue-600"
            />
            <div className="flex-1">
              <div className="mb-2">
                {reading.url ? (
                  <a
                    href={reading.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-lg hover:underline"
                  >
                    {reading.title}
                  </a>
                ) : (
                  <span className="font-medium text-lg text-gray-600">
                    {reading.title}
                  </span>
                )}
                <div className="text-sm text-gray-600 mt-1">
                  {reading.source} · {reading.estimatedTime}
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">{reading.description}</p>

              <div>
                <button
                  onClick={() =>
                    setExpandedNote(expandedNote === reading.id ? null : reading.id)
                  }
                  className="text-sm text-blue-600 hover:underline"
                >
                  {notes[reading.id] ? '檢視筆記' : '新增筆記'}
                </button>

                {expandedNote === reading.id && (
                  <div className="mt-3">
                    <textarea
                      value={notes[reading.id] || ''}
                      onChange={(e) => saveNote(reading.id, e.target.value)}
                      placeholder="你對這篇閱讀的想法或重點摘要..."
                      className="w-full h-24 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
