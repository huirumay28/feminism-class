'use client';

import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';

interface Item {
  id: string;
  question?: string;
  task?: string;
}

interface AnswerBoxProps {
  items: Item[];
  weekNumber: number;
  itemType: 'discussion' | 'homework';
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

export default function AnswerBox({ items, weekNumber, itemType }: AnswerBoxProps) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAnswers();
  }, [weekNumber, itemType]);

  const fetchAnswers = async () => {
    try {
      const response = await fetch('/api/answers');
      if (response.ok) {
        const data: Answer[] = await response.json();
        const answersMap: Record<string, Answer> = {};
        data
          .filter((a) => a.weekNumber === weekNumber && a.itemType === itemType)
          .forEach((a) => {
            answersMap[a.itemId] = a;
          });
        setAnswers(answersMap);
      }
    } catch (error) {
      console.error('Failed to fetch answers:', error);
    }
  };

  const saveAnswer = async (itemId: string, text: string) => {
    const existingAnswer = answers[itemId];
    const answer: Answer = {
      id: existingAnswer?.id || nanoid(),
      weekNumber,
      itemId,
      itemType,
      text,
      uploads: existingAnswer?.uploads || [],
      createdAt: existingAnswer?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    setAnswers({ ...answers, [itemId]: answer });

    try {
      await fetch('/api/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', answer }),
      });
    } catch (error) {
      console.error('Failed to save answer:', error);
    }
  };

  const handleFileUpload = async (itemId: string, file: File) => {
    setUploading({ ...uploading, [itemId]: true });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('weekNumber', weekNumber.toString());
      formData.append('itemId', itemId);

      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const { url } = await response.json();
        const existingAnswer = answers[itemId];
        const answer: Answer = {
          id: existingAnswer?.id || nanoid(),
          weekNumber,
          itemId,
          itemType,
          text: existingAnswer?.text || '',
          uploads: [...(existingAnswer?.uploads || []), url],
          createdAt: existingAnswer?.createdAt || Date.now(),
          updatedAt: Date.now(),
        };

        setAnswers({ ...answers, [itemId]: answer });

        await fetch('/api/answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', answer }),
        });
      } else {
        const error = await response.json();
        alert(error.error || '上傳失敗');
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('上傳失敗,請稍後再試');
    } finally {
      setUploading({ ...uploading, [itemId]: false });
    }
  };

  return (
    <div className="space-y-6">
      {items.map((item, index) => (
        <div key={item.id} className="border border-gray-200 rounded-lg p-6 bg-white">
          <h4 className="font-medium mb-3">
            {index + 1}. {item.question || item.task}
          </h4>

          <textarea
            value={answers[item.id]?.text || ''}
            onChange={(e) => saveAnswer(item.id, e.target.value)}
            placeholder="在此寫下你的回答..."
            className="w-full h-32 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm mb-3"
          />

          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(item.id, file);
                  }
                }}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={uploading[item.id]}
              />
              <span className="text-sm text-blue-600 hover:underline">
                {uploading[item.id] ? '上傳中...' : '附加檔案'}
              </span>
            </label>

            {answers[item.id]?.uploads && answers[item.id].uploads!.length > 0 && (
              <div className="text-sm text-gray-600">
                已附加 {answers[item.id].uploads!.length} 個檔案
              </div>
            )}
          </div>

          {answers[item.id]?.uploads && answers[item.id].uploads!.length > 0 && (
            <div className="mt-3 space-y-2">
              {answers[item.id].uploads!.map((url, idx) => (
                <div
                  key={idx}
                  className="text-sm flex items-center gap-2 text-gray-600"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    附件 {idx + 1}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
