'use client';

import { memo } from 'react';

const ARTICLE_CLASSES =
  'text-[16px] leading-8 text-[#334155] [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:border-b [&_h1]:border-[#e9d5ff] [&_h1]:pb-3 [&_h1]:text-3xl [&_h1]:font-black [&_h1]:leading-tight [&_h1]:text-[#7e22ce] first:[&_h1]:mt-0 [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:leading-tight [&_h2]:text-[#0f766e] [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-[#b45309] [&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:text-[#be185d] [&_h5]:mt-4 [&_h5]:mb-2 [&_h5]:font-bold [&_h5]:text-[#1d4ed8] [&_h6]:mt-4 [&_h6]:mb-2 [&_h6]:font-bold [&_h6]:text-[#475569] [&_p]:mb-4 [&_blockquote]:my-5 [&_blockquote]:rounded-r-xl [&_blockquote]:border-l-4 [&_blockquote]:border-[#7c3aed] [&_blockquote]:bg-[#f5f3ff] [&_blockquote]:p-4 [&_blockquote]:text-[#3b0764] [&_blockquote[class*=emerald]]:border-[#10b981] [&_blockquote[class*=emerald]]:bg-[#ecfdf5] [&_blockquote[class*=emerald]]:text-[#064e3b] [&_blockquote[class*=amber]]:border-[#f59e0b] [&_blockquote[class*=amber]]:bg-[#fffbeb] [&_blockquote[class*=amber]]:text-[#78350f] [&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_li]:pl-1 [&_strong]:font-black [&_strong]:text-[#0f172a] [&_b]:font-black [&_b]:text-[#0f172a] [&_hr]:my-6 [&_hr]:border-[#e2e8f0] [&_mark]:rounded [&_mark]:bg-[#fde68a] [&_mark]:px-1 [&_mark]:text-[#0f172a] [&_a]:font-bold [&_a]:text-[#7c3aed] [&_a]:underline [&_code]:rounded [&_code]:bg-[#f1f5f9] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-bold [&_code]:text-[#7c3aed] [&_img]:my-5 [&_img]:block [&_img]:mx-auto! [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_iframe]:max-w-full [&_table]:w-full [&_table]:border-collapse [&_table]:text-[15px] [&_table]:leading-6 [&_th]:border [&_th]:border-[#cbd5e1] [&_th]:bg-[#f5f3ff] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-bold [&_th]:text-[#3b0764] [&_td]:border [&_td]:border-[#cbd5e1] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_tbody_tr:nth-child(even)_td]:bg-[#faf9ff] [&_td_p]:mb-0 [&_th_p]:mb-0';

/**
 * The article HTML (tables, images, embedded videos). It is memoised so that
 * scroll-driven updates elsewhere in the player never touch this DOM, which
 * would otherwise make embedded YouTube players blink or reload.
 */
export const ArticleBody = memo(function ArticleBody({ html }: { html: string }) {
  return (
    <div
      className={ARTICLE_CLASSES}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
