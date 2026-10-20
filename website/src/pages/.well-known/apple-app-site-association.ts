import type { APIRoute } from 'astro';

/** iOS Universal Links. Set PUBLIC_IOS_TEAM_ID in Cloudflare Pages (Apple Developer Team ID). */
export const GET: APIRoute = () => {
  const teamId = (import.meta.env.PUBLIC_IOS_TEAM_ID ?? 'TEAMID').trim();
  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.net.catsordogs.app`,
          paths: ['/question', '/matches', '/chat/*', '/user/*'],
        },
      ],
    },
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
};
