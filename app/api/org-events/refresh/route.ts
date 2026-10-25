import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/storage';
import orgsData from '@/content/orgs.json';

interface OrgEvent {
  title: string;
  url: string;
}

interface OrgEventsUpdate {
  [orgId: string]: OrgEvent[];
}

interface OrgsContent {
  orgs: Array<{
    id: string;
    nameZh: string;
    eventsUrl: string;
  }>;
}

const ORGS_EVENTS_KEY = 'org-events';

/**
 * Fetch and scrape events from an organization's events URL
 */
async function scrapeOrgEvents(orgId: string, eventsUrl: string): Promise<OrgEvent[]> {
  try {
    const response = await fetch(eventsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FeminismClassBot/1.0)',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`Failed to fetch ${orgId} events: ${response.status}`);
      return [{ title: '最新消息', url: eventsUrl }];
    }

    const html = await response.text();
    const events: OrgEvent[] = [];

    // Simple HTML link extraction - look for <a> tags with href
    // This is a best-effort scrape, not a full parser
    const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = linkPattern.exec(html)) && count < 4) {
      const [, url, title] = match;
      const cleanTitle = title.trim().replace(/\s+/g, ' ');
      
      // Skip navigation links, empty titles, very short titles
      if (
        cleanTitle.length < 5 ||
        /^(more|read more|看更多|home|next|prev|上一頁|下一頁|首頁)$/i.test(cleanTitle) ||
        url.includes('#') ||
        url.startsWith('javascript:')
      ) {
        continue;
      }

      // Make URL absolute if relative
      let fullUrl = url;
      if (url.startsWith('/')) {
        const baseUrl = new URL(eventsUrl);
        fullUrl = `${baseUrl.origin}${url}`;
      } else if (!url.startsWith('http')) {
        const baseUrl = new URL(eventsUrl);
        fullUrl = `${baseUrl.origin}/${url}`;
      }

      events.push({
        title: cleanTitle.length > 100 ? cleanTitle.substring(0, 100) + '...' : cleanTitle,
        url: fullUrl,
      });
      count++;
    }

    // If we found no events, return a generic link
    if (events.length === 0) {
      return [{ title: '最新消息', url: eventsUrl }];
    }

    return events;
  } catch (error) {
    console.error(`Error scraping ${orgId} events:`, error);
    return [{ title: '最新消息', url: eventsUrl }];
  }
}

/**
 * Auto-refresh all organization events
 */
async function autoRefreshAllEvents(): Promise<OrgEventsUpdate> {
  const content = orgsData as unknown as OrgsContent;
  const results: OrgEventsUpdate = {};

  // Fetch all orgs in parallel with a reasonable concurrency
  const promises = content.orgs.map(async (org) => {
    const events = await scrapeOrgEvents(org.id, org.eventsUrl);
    return { orgId: org.id, events };
  });

  const settled = await Promise.allSettled(promises);
  
  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      results[result.value.orgId] = result.value.events;
    }
  });

  return results;
}

/**
 * POST /api/org-events/refresh
 * 
 * Refresh organization events data.
 * Protected by CLASS_PASSCODE header or cookie (same as site auth).
 * 
 * Auto mode (body empty or { "auto": true }):
 *   Fetches each org's eventsUrl and scrapes 2-4 recent links
 * 
 * Manual mode (body: { events: { [orgId]: [{ title, url }] } }):
 *   Stores the provided events data
 * 
 * Returns: { success: true, updated: [...orgIds] } or error
 */
export async function POST(req: NextRequest) {
  // Auth check: same pattern as middleware
  const passcode = process.env.CLASS_PASSCODE?.normalize('NFKC').replace(/\s+/g, '').toLowerCase() || '';
  if (!passcode) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  // Check auth header or cookie
  const authHeader = req.headers.get('x-class-passcode');
  const authCookie = req.cookies.get('feminism-class-auth')?.value;
  
  const data = new TextEncoder().encode('feminism-class:' + passcode);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const expectedToken = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const authorized = (authHeader && authHeader === passcode) || (authCookie && authCookie === expectedToken);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const redis = getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Redis not configured. Events stored in JSON file only.' },
        { status: 503 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let eventsToStore: OrgEventsUpdate;
    let mode: 'auto' | 'manual';

    // Auto mode: no body or { "auto": true }
    if (!body || Object.keys(body).length === 0 || body.auto === true) {
      mode = 'auto';
      console.log('Auto-refreshing events from organization websites...');
      eventsToStore = await autoRefreshAllEvents();
    } else if (body.events && typeof body.events === 'object') {
      // Manual mode: { events: {...} }
      mode = 'manual';
      eventsToStore = body.events;
    } else {
      return NextResponse.json(
        { error: 'Invalid request body. Expected: {} for auto, or { events: { [orgId]: [...] } } for manual' },
        { status: 400 }
      );
    }

    // Store the events data
    await redis.set(ORGS_EVENTS_KEY, eventsToStore);

    const orgIds = Object.keys(eventsToStore);
    return NextResponse.json({
      success: true,
      mode,
      updated: orgIds,
      count: orgIds.length,
      timestamp: new Date().toISOString(),
      events: eventsToStore,
    });
  } catch (error) {
    console.error('Failed to refresh org events:', error);
    return NextResponse.json(
      { error: 'Failed to update events data', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/org-events/refresh
 * 
 * Get current stored events (for debugging).
 * Same auth required.
 */
export async function GET(req: NextRequest) {
  const passcode = process.env.CLASS_PASSCODE?.normalize('NFKC').replace(/\s+/g, '').toLowerCase() || '';
  if (!passcode) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('x-class-passcode');
  const authCookie = req.cookies.get('feminism-class-auth')?.value;
  
  const data = new TextEncoder().encode('feminism-class:' + passcode);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const expectedToken = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const authorized = (authHeader && authHeader === passcode) || (authCookie && authCookie === expectedToken);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const redis = getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Redis not configured' },
        { status: 503 }
      );
    }

    const events = await redis.get<OrgEventsUpdate>(ORGS_EVENTS_KEY);
    return NextResponse.json({
      events: events || {},
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get org events:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve events data' },
      { status: 500 }
    );
  }
}
