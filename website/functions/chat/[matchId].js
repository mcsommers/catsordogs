/** Serve open-app fallback HTML while the browser URL stays /chat/:matchId. */
export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/open-app.html', context.request.url));
  return new Response(asset.body, {
    status: asset.status,
    headers: asset.headers,
  });
}
