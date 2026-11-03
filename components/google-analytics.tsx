import Script from 'next/script';

// Same Google Analytics 4 property as the WordPress site (the Academy is on the same domain),
// so a visitor who goes from the blog to the Academy stays in one session.
// The ID can be changed with NEXT_PUBLIC_GA_MEASUREMENT_ID in Vercel.
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-JYF6XLQTEB';

export function GoogleAnalytics() {
  if (!MEASUREMENT_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
