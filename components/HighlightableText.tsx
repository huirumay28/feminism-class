'use client';

import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';

interface Highlight {
  id: string;
  weekNumber: number;
  text: string;
  color: string;
  startOffset: number;
  endOffset: number;
  chapterNumber?: number;
  note?: string;
  createdAt: number;
}

interface HighlightableTextProps {
  content: string;
  weekNumber: number;
  chapterNumber?: number;
}

const COLORS = [
  { name: 'yellow', class: 'highlight-yellow' },
  { name: 'blue', class: 'highlight-blue' },
  { name: 'green', class: 'highlight-green' },
  { name: 'pink', class: 'highlight-pink' },
];

export default function HighlightableText({
  content,
  weekNumber,
  chapterNumber,
}: HighlightableTextProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedColor, setSelectedColor] = useState('yellow');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    fetchHighlights();
  }, [weekNumber]);

  const fetchHighlights = async () => {
    try {
      const response = await fetch('/api/highlights');
      if (response.ok) {
        const data = await response.json();
        setHighlights(
          data.filter(
            (h: Highlight) =>
              h.weekNumber === weekNumber &&
              (!chapterNumber || h.chapterNumber === chapterNumber)
          )
        );
      }
    } catch (error) {
      console.error('Failed to fetch highlights:', error);
    }
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setShowColorPicker(false);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setShowColorPicker(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setPickerPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
    setShowColorPicker(true);
  };

  const saveHighlight = async (color: string) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    const range = selection.getRangeAt(0);
    
    const highlight: Highlight = {
      id: nanoid(),
      weekNumber,
      chapterNumber,
      text: selectedText,
      color,
      startOffset: 0,
      endOffset: 0,
      createdAt: Date.now(),
    };

    try {
      const response = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', highlight }),
      });

      if (response.ok) {
        setHighlights([...highlights, highlight]);
        setShowColorPicker(false);
        selection.removeAllRanges();
      }
    } catch (error) {
      console.error('Failed to save highlight:', error);
    }
  };

  const deleteHighlight = async (id: string) => {
    try {
      const response = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });

      if (response.ok) {
        setHighlights(highlights.filter((h) => h.id !== id));
        setSelectedHighlight(null);
      }
    } catch (error) {
      console.error('Failed to delete highlight:', error);
    }
  };

  const saveNote = async () => {
    if (!selectedHighlight || !noteText.trim()) return;

    try {
      const response = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateNote',
          id: selectedHighlight.id,
          note: noteText,
        }),
      });

      if (response.ok) {
        setHighlights(
          highlights.map((h) =>
            h.id === selectedHighlight.id ? { ...h, note: noteText } : h
          )
        );
        setShowNoteInput(false);
        setNoteText('');
        setSelectedHighlight(null);
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  return (
    <div className="relative">
      <div
        className="prose-reading whitespace-pre-wrap"
        onMouseUp={handleMouseUp}
      >
        {content}
      </div>

      {showColorPicker && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-2"
          style={{
            left: `${pickerPosition.x}px`,
            top: `${pickerPosition.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => saveHighlight(color.name)}
              className={`w-8 h-8 rounded ${color.class} border border-gray-200 hover:border-gray-900`}
              title={color.name}
            />
          ))}
        </div>
      )}

      {highlights.length > 0 && (
        <div className="mt-8 border-t border-gray-200 pt-8">
          <h3 className="text-lg font-semibold mb-4">本章節劃線 ({highlights.length})</h3>
          <div className="space-y-4">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className={`p-4 rounded-lg border ${
                  COLORS.find((c) => c.name === highlight.color)?.class
                }`}
              >
                <p className="text-sm mb-2">&ldquo;{highlight.text}&rdquo;</p>
                {highlight.note && (
                  <p className="text-sm text-gray-600 italic mb-2">
                    {highlight.note}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedHighlight(highlight);
                      setNoteText(highlight.note || '');
                      setShowNoteInput(true);
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {highlight.note ? '編輯筆記' : '新增筆記'}
                  </button>
                  <button
                    onClick={() => deleteHighlight(highlight.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    刪除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showNoteInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-lg font-semibold mb-4">筆記</h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="在此寫下你的想法..."
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={saveNote}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90"
              >
                儲存
              </button>
              <button
                onClick={() => {
                  setShowNoteInput(false);
                  setNoteText('');
                  setSelectedHighlight(null);
                }}
                className="px-4 py-2 bg-gray-50 text-gray-900 rounded-lg hover:opacity-90"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
