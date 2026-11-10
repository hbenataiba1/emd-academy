// The name a learner confirms before their certificate is created. The same check runs in the
// browser (to help the learner) and on the server (so nothing else can be saved).
export const CERTIFICATE_NAME_MAX = 60;

export type CertificateNameResult = { ok: true; name: string } | { ok: false; error: string };

export function cleanCertificateName(input: string): CertificateNameResult {
  const name = String(input || '').replace(/\s+/g, ' ').trim();

  if (name.length < 2) return { ok: false, error: 'Please write your full name.' };
  if (name.length > CERTIFICATE_NAME_MAX) {
    return { ok: false, error: `Your name is too long (${CERTIFICATE_NAME_MAX} characters at most).` };
  }
  if (/[\d@#$%^&*()_+=[\]{}|\\<>/?!~`":;,]/.test(name)) {
    return { ok: false, error: 'Please use letters only, without numbers or symbols.' };
  }

  // The certificate fonts print Latin letters (accents are fine). Any other script would be
  // missing from the printed certificate, so it is refused here.
  const onlyLatin = !/[^ -ɏ̀-ͯḀ-ỿ’]/.test(name);
  const latinLetters = name.normalize('NFKD').replace(/[^A-Za-z]/g, '');
  if (!onlyLatin || latinLetters.length < 2) {
    return { ok: false, error: 'Please write your name with Latin letters (A to Z), so it prints correctly on the certificate.' };
  }

  return { ok: true, name };
}
