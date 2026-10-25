import orgsData from '@/content/orgs.json';
import { getRedisClient } from '@/lib/storage';

interface Org {
  id: string;
  nameZh: string;
  nameEn: string;
  tags: string[];
  mission: string;
  fightsFor: string;
  does: string;
  feature: string;
  website: string;
  eventsUrl: string;
  coolDairyPillars: string[];
  note?: string;
  events: { title: string; url: string }[];
}

interface ComparisonRow {
  org: string;
  issue: string;
  method: string;
}

interface OrgsData {
  title: string;
  subtitle: string;
  description: string;
  orgs: Org[];
  comparison: {
    table: ComparisonRow[];
    coolDairy: {
      Autonomy: string;
      Individuality: string;
      Community: string;
    };
    note: string;
  };
}

interface OrgEventsUpdate {
  [orgId: string]: { title: string; url: string }[];
}

const ORGS_EVENTS_KEY = 'org-events';

async function getOrgsWithEvents(): Promise<OrgsData> {
  const baseData = orgsData as unknown as OrgsData;
  
  // Try to load refreshed events from Redis
  const redis = getRedisClient();
  if (!redis) {
    return baseData;
  }

  try {
    const refreshedEvents = await redis.get<OrgEventsUpdate>(ORGS_EVENTS_KEY);
    if (!refreshedEvents || Object.keys(refreshedEvents).length === 0) {
      return baseData;
    }

    // Overlay refreshed events onto base data
    const orgsWithRefreshedEvents = baseData.orgs.map((org) => {
      if (refreshedEvents[org.id]) {
        return { ...org, events: refreshedEvents[org.id] };
      }
      return org;
    });

    return {
      ...baseData,
      orgs: orgsWithRefreshedEvents,
    };
  } catch (error) {
    console.error('Failed to load refreshed events from Redis:', error);
    return baseData;
  }
}

export default async function OrgsPage() {
  const data = await getOrgsWithEvents();
  return (
    <div className="wrap">
      <div className="page orgs-page">
        <div className="orgs-header">
          <div className="orgs-kicker">ORGANIZATIONS · 組織</div>
          <h1>{data.title}</h1>
          <p className="orgs-subtitle">{data.subtitle}</p>
          <p className="orgs-description">{data.description}</p>
        </div>

        <div className="orgs-list">
          {data.orgs.map((org, i) => (
            <section key={org.id} className="org-card" id={org.id}>
              <div className="org-number">{String(i + 1).padStart(2, '0')}</div>
              
              <div className="org-header">
                <h2 className="org-name">
                  <span className="org-name-zh">{org.nameZh}</span>
                  <span className="org-name-en">{org.nameEn}</span>
                </h2>
                <div className="org-tags">
                  {org.tags.map((tag) => (
                    <span key={tag} className="org-tag">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="org-body">
                <div className="org-section">
                  <h3>核心宗旨</h3>
                  <p>{org.mission}</p>
                </div>

                <div className="org-section">
                  <h3>爭取什麼</h3>
                  <p>{org.fightsFor}</p>
                </div>

                <div className="org-section">
                  <h3>實際做什麼</h3>
                  <p>{org.does}</p>
                </div>

                <div className="org-section">
                  <h3>特色</h3>
                  <p>{org.feature}</p>
                  {org.note && <p className="org-note">{org.note}</p>}
                </div>

                <div className="org-section org-events">
                  <h3>最新活動</h3>
                  <ul className="events-list">
                    {org.events.map((event, idx) => (
                      <li key={idx}>
                        <a href={event.url} target="_blank" rel="noopener noreferrer">
                          {event.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <a href={org.eventsUrl} target="_blank" rel="noopener noreferrer" className="events-more">
                    看更多活動 →
                  </a>
                </div>

                <div className="org-footer">
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="org-website-btn">
                    官方網站
                  </a>
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="orgs-comparison">
          <h2>九個組織的差異，一張表看懂</h2>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>組織</th>
                  <th>主要議題</th>
                  <th>改變社會的主要方式</th>
                </tr>
              </thead>
              <tbody>
                {data.comparison.table.map((row, i) => (
                  <tr key={i}>
                    <td><strong>{row.org}</strong></td>
                    <td>{row.issue}</td>
                    <td>{row.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cooldairy-mapping">
            <h3>如果對照 Cool Dairy 的三個品牌支柱</h3>
            <p className="cooldairy-intro">以 <strong>Autonomy｜自主、Individuality｜自我、Community｜社群</strong> 來看，可以這樣理解它們的連結：</p>
            
            <div className="pillar-cards">
              <div className="pillar-card">
                <div className="pillar-label">Autonomy｜自主</div>
                <p>{data.comparison.coolDairy.Autonomy}</p>
              </div>
              <div className="pillar-card">
                <div className="pillar-label">Individuality｜自我</div>
                <p>{data.comparison.coolDairy.Individuality}</p>
              </div>
              <div className="pillar-card">
                <div className="pillar-label">Community｜社群</div>
                <p>{data.comparison.coolDairy.Community}</p>
              </div>
            </div>

            <p className="comparison-note">{data.comparison.note}</p>
          </div>
        </div>
      </div>

      <div className="orgs-refresh-note">
        <p className="mono small muted">
          最新活動內容由各組織官網定期更新。如需重新整理活動資訊，請參考 README 文件中的刷新說明。
        </p>
      </div>
    </div>
  );
}
