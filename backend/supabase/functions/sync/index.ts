/**
 * Edge Function: Sync endpoint for WatermelonDB
 *
 * Handles push/pull protocol:
 * - Pull: returns records changed since lastPulledAt
 * - Push: applies client changes to the database
 *
 * TODO: Implement full sync logic in Task 3
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { lastPulledAt, changes } = body;

    // TODO: Implement actual sync logic
    // For now, return empty pull response
    const response = {
      changes: {
        business_config: { created: [], updated: [], deleted: [] },
        user_profiles: { created: [], updated: [], deleted: [] },
        services: { created: [], updated: [], deleted: [] },
        workers: { created: [], updated: [], deleted: [] },
        clients: { created: [], updated: [], deleted: [] },
        appointments: { created: [], updated: [], deleted: [] },
        payments: { created: [], updated: [], deleted: [] },
      },
      timestamp: Date.now(),
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
