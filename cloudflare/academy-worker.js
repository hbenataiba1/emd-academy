// Cloudflare Worker: serves the Vercel academy app under easymedicaldevice.com/academy
// Everything else on the domain keeps going to WordPress (SiteGround).
const ORIGIN = 'https://emd-academy-amber.vercel.app';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, ORIGIN);

    const headers = new Headers(request.headers);
    headers.set('x-forwarded-host', url.host);

    const response = await fetch(
      new Request(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      }),
    );

    // Keep redirects on the public domain instead of leaking the vercel.app URL.
    const location = response.headers.get('location');
    if (location && location.startsWith(ORIGIN)) {
      const out = new Response(response.body, response);
      out.headers.set('location', location.replace(ORIGIN, url.origin));
      return out;
    }

    return response;
  },
};
