export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://easymedicaldevice.com'
).replace(/\/$/, '');

export const ACADEMY_URL = `${SITE_URL}/academy`;
