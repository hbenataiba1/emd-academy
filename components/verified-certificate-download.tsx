'use client';

import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';

import {
  downloadCertificatePdf,
  formatCertificateDate,
  type CertificateSvgPayload,
} from '@/lib/academy-certificate';
import { useCertificatePreviewUrl } from '@/lib/use-certificate-preview';

type VerifiedCertificateDownloadProps = {
  learnerName: string;
  courseTitle: string;
  certificateNumber: string;
  issuedAt: string;
};

export function VerifiedCertificateDownload({
  learnerName,
  courseTitle,
  certificateNumber,
  issuedAt,
}: VerifiedCertificateDownloadProps) {
  const [downloading, setDownloading] = useState(false);
  const payload: CertificateSvgPayload = {
    learnerName,
    courseTitle,
    certificateTitle: 'Certificate of Completion',
    certificateNumber,
    issuedDate: formatCertificateDate(issuedAt),
  };
  const previewUrl = useCertificatePreviewUrl(payload);

  async function download() {
    setDownloading(true);
    try {
      await downloadCertificatePdf(payload);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="border-t border-[#ece7f7] px-6 py-8 sm:px-8">
      <div className="overflow-hidden rounded-xl border border-[#e4ddf4] bg-[#f7f4ff] shadow-sm">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`Certificate issued to ${learnerName}`}
            className="block aspect-[8/5] w-full"
          />
        ) : (
          <div className="aspect-[8/5] w-full animate-pulse bg-[#efeafd]" />
        )}
      </div>

      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white transition hover:bg-[#6d31dc] disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      >
        {downloading ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        {downloading ? 'Preparing PDF...' : 'Download certificate (PDF)'}
      </button>
    </div>
  );
}
