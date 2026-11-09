import { getCertificateVerifyUrl } from '@/lib/certificate-qr';
import { MORE_LINKEDIN_POSTS } from '@/lib/linkedin-posts-more';

/**
 * Ready-made LinkedIn posts about a certificate. {course} and {link} are replaced when a
 * post is picked. The first one is the default; the others are the "generate another post"
 * choices, in different tones.
 */
const BASE_TEMPLATES: string[] = [
  `🎓 I just earned my certificate in "{course}"!

I completed the course and passed the final exam at Easy Medical Device Academy. Keeping my regulatory and quality knowledge sharp is a priority, and this was a practical, well-structured way to do it.

✅ You can verify my certificate here: {link}

#MedicalDevices #RegulatoryAffairs #MDR #IVDR #ISO13485 #ContinuousLearning`,

  `Proud to share that I'm now certified in "{course}" 🎉

The final exam was not a formality: it made me go back over the details that matter in real regulatory work. Grateful to Easy Medical Device Academy for the clear, practical training.

Certificate (verifiable): {link}

#MedTech #RegulatoryAffairs #Compliance #ProfessionalDevelopment`,

  `New certificate unlocked 🔓

"{course}" ✔️ Passed the final exam at Easy Medical Device Academy.

Learning never stops in medical devices, and I'm glad to keep investing in my skills.

Verify it here 👉 {link}

#MedicalDevices #QualityManagement #Regulatory #Learning`,

  `Medical device regulation moves fast, so I keep learning. 📚

This week I completed "{course}" at Easy Medical Device Academy and passed the final exam.

What I like about it: it is practical, it is clear, and it connects the rules to the day-to-day work of regulatory and quality teams.

My certificate: {link}

#RegulatoryAffairs #MDR #MedTech #CareerGrowth`,

  `Another step on my regulatory journey ✅

I've just been certified in "{course}" through Easy Medical Device Academy.

If you work in medical devices and want training you can apply on Monday morning, I recommend it.

Check my certificate: {link}

#MedicalDevices #Regulatory #Training #Compliance`,

  `I did it! 🙌

"{course}" is complete and the certificate is officially mine. Thank you to the team at Easy Medical Device Academy for a course that is useful from the first lesson to the final exam.

You can verify the certificate here: {link}

#MedTech #IVDR #MDR #Achievement`,

  `Investing in my skills: done ✔️

I earned the "{course}" certificate from Easy Medical Device Academy.

Three things I take away: know the requirements, document everything, and never stop learning.

Credential: {link}

#QualityAssurance #RegulatoryAffairs #MedicalDevices #Growth`,

  `Quick update from my learning journey 🎯

Certified: "{course}"
Where: Easy Medical Device Academy
Result: passed the final exam

On to the next challenge. If you are preparing for the same topic, feel free to ask me about it.

Proof of certificate: {link}

#MedTech #Regulatory #ISO13485 #Learning`,

  `Certified. Verified. Motivated. 💪

I've completed "{course}" and passed the final certification exam at Easy Medical Device Academy.

Here is the link that proves it: {link}

#MedicalDevices #MDR #RegulatoryAffairs #Certification`,

  `Why I chose to study "{course}":

Because in medical devices, being almost right is not enough. 🧠

I'm happy to announce that I completed the course and earned my certificate at Easy Medical Device Academy.

Verify it here: {link}

#PatientSafety #Regulatory #QualityManagement #MedTech`,

  `Small win, big motivation 🌟

I finished "{course}" at Easy Medical Device Academy and the certificate is in my hands (well, on my screen).

Always learning, always improving. Thank you to everyone who supports me.

Certificate: {link}

#ProfessionalDevelopment #MedicalDevices #Regulatory #Learning`,

  `Teams that learn together stay compliant together 🤝

I've just completed "{course}" with Easy Medical Device Academy, and I'm bringing what I learned back to my work.

Verify my certificate: {link}

#Compliance #MedTech #RegulatoryAffairs #Teamwork`,

  `Exam passed. ✅

"{course}", Easy Medical Device Academy. The questions were fair and made me think, which is exactly what I wanted from a certification.

See the certificate here: {link}

#MedicalDevices #MDR #IVDR #Exam #RegulatoryAffairs`,

  `A little more knowledge, a lot more confidence 💡

I earned my certificate in "{course}" at Easy Medical Device Academy.

If you are thinking about upskilling in regulatory affairs or quality, this is a good place to start.

Verify: {link}

#Upskilling #RegulatoryAffairs #QualityManagement #MedTech`,

  `Big thanks to Easy Medical Device Academy 🙏

I completed "{course}" and passed the final exam. The lessons were clear and I can already use them in my daily work.

My certificate, publicly verifiable: {link}

#Gratitude #MedicalDevices #Regulatory #Learning`,

  `Adding a new line to my CV today 📄

Certificate in "{course}", Easy Medical Device Academy. Passed the final exam. Verified online.

Check it yourself: {link}

#CareerDevelopment #MedTech #RegulatoryAffairs #Certification`,

  `Learning in public: I just finished "{course}" 🎓

What worked for me: short lessons, real examples, and a final exam that checks what you retained.

Thank you, Easy Medical Device Academy. My certificate is here: {link}

#LearnInPublic #MedicalDevices #Regulatory #Training`,

  `Regulatory knowledge: updated ✔️

I've been certified in "{course}" by Easy Medical Device Academy. Ready to apply it, one project at a time.

Verification link: {link}

#MDR #IVDR #RegulatoryAffairs #MedicalDevices #Compliance`,

  `Milestone reached 🚀

"{course}" ✅ Final exam ✅ Certificate ✅

Thank you Easy Medical Device Academy for the quality of the training.

You can verify my certificate here: {link}

#Milestone #MedTech #QualityAssurance #RegulatoryAffairs`,

  `If you work with medical devices, this one is for you 👇

I completed "{course}" at Easy Medical Device Academy and earned my certificate. It is practical, clear and well organised.

Certificate: {link}

#MedicalDevices #Regulatory #ISO13485 #MDR #ProfessionalGrowth`,

  `Ending the week with good news 🎉

I have officially earned my certificate in "{course}"! Easy Medical Device Academy made it easy to learn at my own pace.

See it here: {link}

#FridayFeeling #MedTech #Learning #RegulatoryAffairs`,
];

const TEMPLATES: string[] = [...BASE_TEMPLATES, ...MORE_LINKEDIN_POSTS];

// Every post says "Easy Medical Device Academy from @Easy Medical Device", so the learner
// can tag the company page when the post is open in LinkedIn.
const ACADEMY_NAME = 'Easy Medical Device Academy';
const ACADEMY_WITH_TAG = `${ACADEMY_NAME} from @Easy Medical Device`;

function withCompanyTag(text: string) {
  const index = text.indexOf(ACADEMY_NAME);
  if (index === -1) return `${text}\n\n${ACADEMY_WITH_TAG}`;
  return text.slice(0, index) + ACADEMY_WITH_TAG + text.slice(index + ACADEMY_NAME.length);
}

/** How many posts there are to choose from. */
export const LINKEDIN_POST_COUNT = TEMPLATES.length;

export function buildLinkedInPost({
  courseTitle,
  certificateNumber,
  index = 0,
}: {
  courseTitle: string;
  certificateNumber: string;
  /** Which post to write (the default is the first one). */
  index?: number;
}) {
  const template = TEMPLATES[((index % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length];
  return withCompanyTag(template)
    .replaceAll('{course}', courseTitle)
    .replaceAll('{link}', getCertificateVerifyUrl(certificateNumber));
}
