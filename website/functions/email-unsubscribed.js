/** Unsubscribe redirect lands here; serve open-app.html (query type= is read in-page). */
export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/open-app.html', context.request.url));
  return new Response(asset.body, {
    status: asset.status,
    headers: asset.headers,
  });
}
