import { ACADEMY_FAQ } from '@/lib/academy-faq';

// Plain, readable text about the medical device courses, with the questions people ask.
// It is part of the page itself (not hidden), so visitors and search engines see the same thing.
const TOPICS = [
  { name: 'EU MDR training', text: 'Understand Regulation (EU) 2017/745, technical documentation, GSPR and notified body expectations.' },
  { name: 'IVDR training', text: 'Learn the requirements for in vitro diagnostic devices under Regulation (EU) 2017/746.' },
  { name: 'ISO 13485 courses', text: 'Build and run a quality management system that stands up to audits.' },
  { name: 'Software as a medical device', text: 'Bring medical software and digital health products to market in a compliant way.' },
  { name: 'Risk management', text: 'Apply risk management to design, manufacturing and the whole product life cycle.' },
  { name: 'Market access', text: 'Plan your regulatory strategy and enter international medical device markets.' },
];

export function AcademySeoSection() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="medical-device-courses-title">
        <h2 id="medical-device-courses-title" className="text-3xl font-bold text-[#191625] sm:text-4xl">
          Medical device courses for every topic
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#625b75] sm:text-base">
          Our medical device courses are practical, taught by working experts and built around the topics
          regulatory, quality and engineering teams face every day. Learn at your own pace, pass the final exam and
          get a certificate you can verify online and share on LinkedIn.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map((topic) => (
            <article key={topic.name} className="rounded-2xl border border-[#e4ddf4] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#191625]">{topic.name}</h3>
              <p className="mt-2 text-sm leading-6 text-[#625b75]">{topic.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="bg-[#f8f6ff] py-14" aria-labelledby="medical-device-courses-faq">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 id="medical-device-courses-faq" className="text-center text-3xl font-bold text-[#191625] sm:text-4xl">
            Medical device courses: your questions
          </h2>
          <div className="mt-8 space-y-3">
            {ACADEMY_FAQ.map((item) => (
              <details key={item.question} className="group rounded-2xl border border-[#e4ddf4] bg-white p-5">
                <summary className="cursor-pointer list-none text-sm font-bold marker:hidden sm:text-base">
                  <span className="flex items-center justify-between gap-3">
                    {item.question}
                    <span className="text-xl leading-none text-[#7c3aed] transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-[#5f5872]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
