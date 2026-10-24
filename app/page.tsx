import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';

interface WeekTopic {
  week: number;
  title: string;
  status: 'available' | 'upcoming';
}

interface Module {
  moduleNumber: number;
  title: string;
  weeks: string;
  description: string;
  learningGoal: string;
  weekTopics: WeekTopic[];
}

interface Curriculum {
  title: string;
  subtitle: string;
  duration: string;
  description: string;
  modules: Module[];
}

async function getCurriculum(): Promise<Curriculum> {
  const filePath = path.join(process.cwd(), 'content', 'curriculum.json');
  const fileContents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(fileContents);
}

export default async function Home() {
  const curriculum = await getCurriculum();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{curriculum.title}</h1>
        <p className="text-xl text-gray-600 mb-2">{curriculum.subtitle}</p>
        <p className="text-lg text-gray-600 mb-6">{curriculum.duration}</p>
        <p className="text-lg leading-relaxed">{curriculum.description}</p>
      </header>

      <div className="space-y-12">
        {curriculum.modules.map((module) => (
          <section key={module.moduleNumber} className="border-l-4 border-blue-600 pl-6">
            <div className="mb-6">
              <div className="text-sm text-gray-600 mb-2">
                第 {module.moduleNumber} 個月 · {module.weeks}
              </div>
              <h2 className="text-2xl font-semibold mb-3">{module.title}</h2>
              <p className="text-gray-600 mb-2">{module.description}</p>
              <p className="text-sm">
                <span className="font-medium">學習目標：</span>
                {module.learningGoal}
              </p>
            </div>

            <div className="space-y-3">
              {module.weekTopics.map((topic) => {
                const isAvailable = topic.status === 'available';
                return (
                  <div
                    key={topic.week}
                    className={`p-4 rounded-lg border ${
                      isAvailable
                        ? 'bg-white border-blue-600 shadow-sm'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {isAvailable ? (
                      <Link
                        href={`/week/${topic.week}`}
                        className="block no-underline hover:no-underline"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-blue-600">
                              Week {topic.week}
                            </span>
                            <h3 className="text-lg font-medium text-gray-900 mt-1">
                              {topic.title}
                            </h3>
                          </div>
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-600">
                            Week {topic.week}
                          </span>
                          <h3 className="text-lg font-medium text-gray-600 mt-1">
                            {topic.title}
                          </h3>
                        </div>
                        <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                          即將推出
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
