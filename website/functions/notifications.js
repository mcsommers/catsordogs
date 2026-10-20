/** Notification settings deep link; same pattern as /user and /chat. */
export async function onRequest(context) {
  const asset = await context.env.ASSETS.fetch(new URL('/open-app.html', context.request.url));
  return new Response(asset.body, {
    status: asset.status,
    headers: asset.headers,
  });
}
