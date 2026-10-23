/** Email confirmation / password reset: keep /auth-callback in the URL and pass query params to the app. */
export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/open-app.html', context.request.url));
  return new Response(asset.body, {
    status: asset.status,
    headers: asset.headers,
  });
}
