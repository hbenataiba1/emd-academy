import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, CircleAlert, ShieldX } from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import { VerifiedCertificateDownload } from '@/components/verified-certificate-download';
import { formatCertificateDate } from '@/lib/academy-certificate';
import { lookupCertificate } from '@/lib/academy-verify';

export const metadata: Metadata = {
  title: 'Verify certificate | Easy Medical Device Academy',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type VerifyPageProps = {
  params: Promise<{ certificateNumber: string }>;
};

export default async function VerifyCertificatePage({
  params,
}: VerifyPageProps) {
  const { certificateNumber } = await params;
  const certificate = await lookupCertificate(
    decodeURIComponent(certificateNumber),
  );
  const state = !certificate
    ? 'invalid'
    : certificate.revoked
      ? 'revoked'
      : 'valid';

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader activePage="home" />

      <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-[#e4ddf4] bg-white shadow-[0_24px_70px_rgb(38_29_68/10%)]">
          <div
            className={`flex items-center gap-4 px-6 py-5 sm:px-8 ${
              state === 'valid'
                ? 'bg-[#ecfdf5] text-[#065f46]'
                : state === 'revoked'
                  ? 'bg-[#fffbeb] text-[#92400e]'
                  : 'bg-[#fef2f2] text-[#991b1b]'
            }`}
          >
            {state === 'valid' ? (
              <BadgeCheck className="size-10 shrink-0" aria-hidden="true" />
            ) : state === 'revoked' ? (
              <CircleAlert className="size-10 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldX className="size-10 shrink-0" aria-hidden="true" />
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">
                Certificate verification
              </p>
              <h1 className="text-2xl font-black sm:text-3xl">
                {state === 'valid'
                  ? 'Certificate verified'
                  : state === 'revoked'
                    ? 'Certificate revoked'
                    : 'Certificate not found'}
              </h1>
            </div>
          </div>

          {certificate ? (
            <>
            <div className="px-6 py-8 sm:px-8">
              <p className="text-sm font-semibold text-[#6e687d]">
                {state === 'valid'
                  ? 'This certificate was issued to'
                  : 'This certificate was issued to (no longer valid)'}
              </p>
              <p className="mt-1 font-serif text-4xl font-bold italic text-[#3b0764] sm:text-5xl">
                {certificate.learnerName}
              </p>

              <p className="mt-6 text-sm font-semibold text-[#6e687d]">
                for successfully completing
              </p>
              <p className="mt-1 text-xl font-black text-[#581c87] sm:text-2xl">
                {certificate.courseTitle}
              </p>

              <dl className="mt-8 grid gap-4 border-t border-[#ece7f7] pt-6 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold uppercase tracking-wide text-[#8b849a]">
                    Issue date
                  </dt>
                  <dd className="mt-1 text-base font-bold">
                    {formatCertificateDate(certificate.issuedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold uppercase tracking-wide text-[#8b849a]">
                    Certificate ID
                  </dt>
                  <dd className="mt-1 break-all text-base font-bold">
                    {certificate.certificateNumber}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold uppercase tracking-wide text-[#8b849a]">
                    Issued by
                  </dt>
                  <dd className="mt-1 text-base font-bold">
                    Easy Medical Device Academy
                  </dd>
                </div>
                <div>
                  <dt className="font-bold uppercase tracking-wide text-[#8b849a]">
                    Authorised by
                  </dt>
                  <dd className="mt-1 text-base font-bold">Monir El Azzouzi</dd>
                </div>
              </dl>
            </div>
            {state === 'valid' ? (
              <VerifiedCertificateDownload
                learnerName={certificate.learnerName}
                courseTitle={certificate.courseTitle}
                certificateNumber={certificate.certificateNumber}
                issuedAt={certificate.issuedAt}
              />
            ) : null}
            </>
          ) : (
            <div className="px-6 py-8 sm:px-8">
              <p className="text-base leading-7 text-[#514b63]">
                We could not find a certificate with this ID. Check that the QR
                code or link was copied completely. If you believe this is a
                mistake, contact us and include the certificate ID.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-[#6e687d]">
          <Link
            href="/academy"
            className="font-bold text-[#7c3aed] hover:text-[#6d31dc]"
          >
            Explore Easy Medical Device Academy
          </Link>
        </p>
      </section>

      <AcademyFooter />
    </main>
  );
}
