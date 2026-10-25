import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/storage';

interface OrgEvent {
  title: string;
  url: string;
}

interface OrgEventsUpdate {
  [orgId: string]: OrgEvent[];
}

const ORGS_EVENTS_KEY = 'org-events';

/**
 * POST /api/org-events/refresh
 * 
 * Refresh organization events data.
 * Protected by CLASS_PASSCODE header or cookie (same as site auth).
 * 
 * Body: { events: { [orgId]: [{ title, url }] } }
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
    const body = await req.json() as { events?: OrgEventsUpdate };
    
    if (!body.events || typeof body.events !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. Expected: { events: { [orgId]: [...] } }' },
        { status: 400 }
      );
    }

    const redis = getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Redis not configured. Events stored in JSON file only.' },
        { status: 503 }
      );
    }

    // Store the events data
    await redis.set(ORGS_EVENTS_KEY, body.events);

    const orgIds = Object.keys(body.events);
    return NextResponse.json({
      success: true,
      updated: orgIds,
      count: orgIds.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to refresh org events:', error);
    return NextResponse.json(
      { error: 'Failed to update events data' },
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
