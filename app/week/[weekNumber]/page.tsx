import { promises as fs } from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import HighlightableText from '@/components/HighlightableText';
import ReadingChecklist from '@/components/ReadingChecklist';
import AnswerBox from '@/components/AnswerBox';

interface Chapter {
  number: number;
  title: string;
  content: string;
}

interface Reading {
  id: string;
  title: string;
  url: string | null;
  source: string;
  description: string;
  estimatedTime: string;
}

interface DiscussionQuestion {
  id: string;
  question: string;
}

interface Homework {
  id: string;
  task: string;
}

interface WeekData {
  weekNumber: number;
  title: string;
  subtitle: string;
  period: string;
  introduction: string;
  learningGoals: string[];
  chapters: Chapter[];
  readings: Reading[];
  discussionQuestions: DiscussionQuestion[];
  homework: Homework[];
  exercises?: { id: string; question: string }[];
  nextWeekPreview: string;
}

async function getWeekData(weekNumber: string): Promise<WeekData | null> {
  try {
    const filePath = path.join(
      process.cwd(),
      'content',
      'weeks',
      `week-${weekNumber.padStart(2, '0')}.json`
    );
    const fileContents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch {
    return null;
  }
}

export default async function WeekPage({
  params,
}: {
  params: Promise<{ weekNumber: string }>;
}) {
  const { weekNumber } = await params;
  const weekData = await getWeekData(weekNumber);

  if (!weekData) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <nav className="mb-8">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← 返回課程總覽
        </Link>
      </nav>

      <header className="mb-12 pb-8 border-b border-gray-200">
        <div className="text-sm text-gray-600 mb-2">
          Week {weekData.weekNumber} · {weekData.period}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">{weekData.title}</h1>
        <p className="text-lg text-gray-600">{weekData.subtitle}</p>
      </header>

      <section className="mb-12">
        <HighlightableText
          content={weekData.introduction}
          weekNumber={weekData.weekNumber}
        />
      </section>

      <section className="mb-12 bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">學習目標</h2>
        <ul className="space-y-2">
          {weekData.learningGoals.map((goal, index) => (
            <li key={index} className="flex gap-3">
              <span className="text-blue-600 font-medium">{index + 1}.</span>
              <span>{goal}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-8">本週課程</h2>
        <div className="space-y-12">
          {weekData.chapters.map((chapter) => (
            <div key={chapter.number}>
              <h3 className="text-xl font-semibold mb-4">
                {chapter.number}. {chapter.title}
              </h3>
              <HighlightableText
                content={chapter.content}
                weekNumber={weekData.weekNumber}
                chapterNumber={chapter.number}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">延伸閱讀清單</h2>
        <ReadingChecklist readings={weekData.readings} weekNumber={weekData.weekNumber} />
      </section>

      {weekData.exercises && weekData.exercises.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-2">閱讀問題與練習</h2>
          <p className="text-sm text-gray-600 mb-6">每題都可以寫下回答並上傳檔案。</p>
          <AnswerBox
            items={weekData.exercises}
            weekNumber={weekData.weekNumber}
            itemType="exercise"
          />
        </section>
      )}

      {weekData.discussionQuestions && weekData.discussionQuestions.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">研討問題</h2>
          <AnswerBox
            items={weekData.discussionQuestions}
            weekNumber={weekData.weekNumber}
            itemType="discussion"
          />
        </section>
      )}

      {weekData.homework && weekData.homework.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">本週作業</h2>
          <AnswerBox
            items={weekData.homework}
            weekNumber={weekData.weekNumber}
            itemType="homework"
          />
        </section>
      )}

      {weekData.nextWeekPreview && (
        <section className="mt-16 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">下週預告</h3>
          <p className="text-gray-600">{weekData.nextWeekPreview}</p>
        </section>
      )}
    </div>
  );
}
