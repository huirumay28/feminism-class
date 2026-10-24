'use client';

import { MdToolbar, mdKeyDown } from './NoteMd';
import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';

interface Item { id: string; question?: string; task?: string }
type ItemType = 'discussion' | 'homework' | 'exercise';
interface Answer {
  id: string; weekNumber: number; itemId: string; itemType: ItemType; text: string;
  uploads?: string[]; createdAt: number; updatedAt: number;
}

const LABEL: Record<ItemType, string> = { exercise: 'Q', discussion: 'S', homework: 'HW' };

function fileName(url: string) {
  try { return decodeURIComponent(url.split('/').pop() || '附件').replace(/^\d+-/, ''); } catch { return '附件'; }
}

export default function AnswerBox({ items, weekNumber, itemType, color }: { items: Item[]; weekNumber: number; itemType: ItemType; color?: string }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latest = useRef<Record<string, Answer>>({});

  useEffect(() => {
    fetch('/api/answers').then((r) => (r.ok ? r.json() : [])).then((data: Answer[]) => {
      const map: Record<string, Answer> = {};
      data.filter((a) => a.weekNumber === weekNumber && a.itemType === itemType).forEach((a) => { map[a.itemId] = a; });
      latest.current = map;
      setAnswers(map);
    }).catch(() => {});
  }, [weekNumber, itemType]);

  const persist = async (answer: Answer) => {
    setStatus((s) => ({ ...s, [answer.itemId]: '儲存中…' }));
    const r = await fetch('/api/answers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', answer }) }).catch(() => null);
    setStatus((s) => ({ ...s, [answer.itemId]: r && r.ok ? '已儲存 ✓' : '儲存失敗' }));
  };

  const update = (itemId: string, patch: Partial<Answer>, immediate = false) => {
    const prev = latest.current[itemId];
    const answer: Answer = {
      id: prev?.id || nanoid(), weekNumber, itemId, itemType, text: prev?.text || '', uploads: prev?.uploads || [],
      createdAt: prev?.createdAt || Date.now(), ...patch, updatedAt: Date.now(),
    };
    latest.current = { ...latest.current, [itemId]: answer };
    setAnswers(latest.current);
    clearTimeout(timers.current[itemId]);
    if (immediate) persist(answer);
    else { setStatus((s) => ({ ...s, [itemId]: '…' })); timers.current[itemId] = setTimeout(() => persist(latest.current[itemId]), 800); }
  };

  const upload = async (itemId: string, file: File) => {
    setStatus((s) => ({ ...s, [itemId]: '上傳中…' }));
    const fd = new FormData();
    fd.append('file', file); fd.append('weekNumber', String(weekNumber)); fd.append('itemId', itemId);
    const r = await fetch('/api/uploads', { method: 'POST', body: fd }).catch(() => null);
    if (r && r.ok) {
      const { url } = await r.json();
      update(itemId, { uploads: [...(latest.current[itemId]?.uploads || []), url] }, true);
    } else {
      setStatus((s) => ({ ...s, [itemId]: '上傳失敗' }));
    }
  };

  return (
    <div>
      {items.map((item, i) => {
        const a = answers[item.id];
        return (
          <div className="qcard" key={item.id} style={{ ['--c' as string]: color }}>
            <div className="qhead">
              <div className="qnum">{LABEL[itemType]}{String(i + 1).padStart(2, '0')}</div>
              <div className="qtext">{item.question || item.task}</div>
            </div>
            <MdToolbar get={() => document.getElementById(`ans-${item.id}`) as HTMLTextAreaElement | null} set={(v, x, y) => { update(item.id, { text: v }); requestAnimationFrame(() => { const t = document.getElementById(`ans-${item.id}`) as HTMLTextAreaElement | null; if (t && document.activeElement !== t) { t.focus(); t.setSelectionRange(x, y); } }); }} />
            <textarea
              id={`ans-${item.id}`}
              onKeyDown={(e) => mdKeyDown(e, (v) => update(item.id, { text: v }))}
              className="ruled"
              value={a?.text || ''}
              onChange={(e) => update(item.id, { text: e.target.value })}
              placeholder="寫在這一頁…"
              aria-label={`回答 ${item.question || item.task}`}
            />
            <div className="qfoot">
              <label className="btn" style={{ padding: '3px 10px' }}>
                <input type="file" hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.txt,.md"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(item.id, f); e.target.value = ''; }} />
                ⇪ 上傳檔案
              </label>
              <div className="files">
                {(a?.uploads || []).map((u, k) => (
                  <a key={k} className="chip" href={u} target="_blank" rel="noopener noreferrer">📎 {fileName(u)}</a>
                ))}
              </div>
              <span className="status">{status[item.id] || (a?.updatedAt ? `上次儲存 ${new Date(a.updatedAt).toLocaleDateString('zh-TW')}` : '')}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
