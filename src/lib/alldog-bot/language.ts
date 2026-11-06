/**
 * AllDog WhatsApp bot — item 42 (Or, 6/11): the conversation follows the customer's language.
 * Pure, tested (alldog-item42.test.ts).
 *
 * Hanna (5/11) wrote in English and got a Hebrew greeting, a Hebrew price line, a Hebrew closing,
 * and prices cut out of her English answers. The bot now answers in the customer's language
 * (Hebrew / English / Russian / French / Arabic), and every fixed line the system adds (opening,
 * prices, transition + closing, fallback, partial closing) comes in that language too.
 * Trainers (Or, 6/11): lessons in Hebrew or English; there are also trainers who speak Russian
 * and French, subject to their availability, so a language is never promised.
 * The journal in Petra stays in Hebrew (the rep reads it), with a "הלקוח כותב ב…" fact.
 */
import type { Gender } from "@/lib/alldog-bot/address";

export type BotLang = "he" | "en" | "ru" | "fr" | "ar";

export const LANG_LABEL_HE: Record<BotLang, string> = {
  he: "עברית",
  en: "אנגלית",
  ru: "רוסית",
  fr: "צרפתית",
  ar: "ערבית",
};

/** Canned texts that say nothing about the customer's language (Meta click-to-WhatsApp ads, the site's button). */
const NEUTRAL_TEXTS = [
  /^i'?m\s+interested[.!]?\s*can\s+i\s+(?:learn|get)\s+more(?:\s+info(?:rmation)?)?[?.!]?$/i,
  /^hello!?\s*can\s+i\s+get\s+more\s+info(?:rmation)?\s+(?:on|about)\s+this\??$/i,
  /^היי\s+alldog,?\s+אשמח\s+לעזרה\s+עם\s+הכלב\s+שלי/iu,
];

export function isNeutralCannedText(text: string): boolean {
  const t = text.replace(/[\p{Extended_Pictographic}‍️]/gu, "").replace(/\s+/g, " ").trim();
  return NEUTRAL_TEXTS.some((re) => re.test(t));
}

const FRENCH_RE = /(?:^|[^\p{L}])(?:bonjour|bonsoir|merci|je|j'ai|j’ai|mon|ma|mes|chien|chienne|avec|pour|est|très|il|elle|nous|vous|c'est|c’est|pas|une|des|les|du|au|chiot)(?=[^\p{L}]|$)/giu;
const ENGLISH_RE = /(?:^|[^\p{L}])(?:the|and|my|is|i|i'm|we|our|dog|puppy|he|she|with|for|have|has|to|of|you|your|hi|hello|thanks|what|how)(?=[^\p{L}]|$)/giu;

function scriptCounts(text: string) {
  return {
    he: (text.match(/[֐-׿]/g) ?? []).length,
    ar: (text.match(/[؀-ۿ]/g) ?? []).length,
    ru: (text.match(/[Ѐ-ӿ]/g) ?? []).length,
    latin: (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length,
  };
}

/** The language of one message, or null when it is too short / mixed to tell. */
export function languageOfText(text: string): BotLang | null {
  const t = text.replace(/https?:\/\/\S+/g, " ").replace(/AllDog/gi, " ");
  if (isNeutralCannedText(text)) return null;
  const c = scriptCounts(t);
  const total = c.he + c.ar + c.ru + c.latin;
  if (total < 8) return null; // "Max", "Arlo", "ok" decide nothing
  const top = (Object.entries(c) as Array<[keyof typeof c, number]>).sort((a, b) => b[1] - a[1])[0];
  if (top[1] / total < 0.6) return null;
  if (top[0] === "latin") {
    const fr = (t.match(FRENCH_RE) ?? []).length + (/[éèêàçùœ]/i.test(t) ? 1 : 0);
    const en = (t.match(ENGLISH_RE) ?? []).length;
    return fr > en ? "fr" : "en";
  }
  return top[0];
}

/**
 * The conversation's language: the customer's newest message that clearly has one; default Hebrew.
 * Canned ad / site texts never decide it.
 */
export function detectLanguage(customerTexts: string[]): BotLang {
  for (let i = customerTexts.length - 1; i >= 0; i--) {
    const l = languageOfText(customerTexts[i]);
    if (l) return l;
  }
  return "he";
}

// ─── Fixed lines per language ────────────────────────────────────────────────

/** First-reply greeting (Hebrew = OPENING_GREETING in prompt.ts). */
export const GREETING: Record<Exclude<BotLang, "he">, string> = {
  en: "Hi! AllDog team here 🙂",
  ru: "Здравствуйте! Это команда AllDog 🙂",
  fr: "Bonjour ! Ici l'équipe AllDog 🙂",
  ar: "أهلاً! معك فريق AllDog 🙂",
};

/** "I'd love to hear a bit about your dog" — the opening when the first message says nothing yet. */
export const ASK_ABOUT_DOG: Record<Exclude<BotLang, "he">, string> = {
  en: "I'd love to hear a bit about your dog",
  ru: "Расскажите, пожалуйста, коротко о вашей собаке",
  fr: "Racontez-moi en quelques mots ce qui se passe avec votre chien",
  ar: "احكِ لي باختصار عن الكلب",
};

/** Item 40.6 / 41 short price answer, translated (Hebrew = PRICE_ANSWER_LINE). */
export const PRICE_SHORT: Record<Exclude<BotLang, "he">, string> = {
  en: "The phone consultation is free, and a home assessment is 350 ₪, which is deducted if you continue to intensive training. Intensive training is priced after the assessment, and you can pay in installments.",
  ru: "Консультация по телефону бесплатная, диагностика дома стоит 350 ₪ и засчитывается, если вы продолжаете интенсивное обучение. Цену интенсивного обучения определяют после диагностики, можно платить в рассрочку.",
  fr: "La consultation téléphonique est gratuite, et le diagnostic à domicile coûte 350 ₪, déduits si vous continuez avec le dressage intensif. Le prix du dressage intensif est fixé après le diagnostic, et le paiement peut se faire en plusieurs fois.",
  ar: "الاستشارة الهاتفية مجانية، والتشخيص في البيت 350 ₪ وتُخصم إذا استمريتم بالتدريب المكثف. سعر التدريب المكثف يُحدد بعد التشخيص، ويمكن الدفع بالتقسيط.",
};

/** Item 41 full price list + boarding (Or, 6/11), translated (Hebrew = FULL_PRICE_LIST). */
export const PRICE_FULL: Record<Exclude<BotLang, "he">, string> = {
  en: [
    "Prices in short:",
    "• Phone consultation: free",
    "• Home assessment: 350 ₪, deducted if you continue with training",
    "• Private lessons: 350 ₪ for a single session, or 300 ₪ per session in a package of at least 6",
    "• Boarding: about 120 to 140 ₪ a day, depending on the place that takes the dog. The representative will get back to you with exact prices",
    "• Intensive training and training in boarding: priced after the assessment, installments possible",
  ].join("\n"),
  ru: [
    "Коротко о ценах:",
    "• Консультация по телефону: бесплатно",
    "• Диагностика дома: 350 ₪, засчитывается, если продолжаете обучение",
    "• Частные уроки: 350 ₪ за одно занятие или 300 ₪ за занятие в пакете от 6 занятий",
    "• Передержка: примерно 120 до 140 ₪ в день, зависит от места. Представитель вернётся к вам с точными ценами",
    "• Интенсивное обучение и обучение на передержке: по итогам диагностики, можно в рассрочку",
  ].join("\n"),
  fr: [
    "Les prix en bref :",
    "• Consultation téléphonique : gratuite",
    "• Diagnostic à domicile : 350 ₪, déduits si vous continuez le dressage",
    "• Cours particuliers : 350 ₪ la séance, ou 300 ₪ la séance dans un forfait d'au moins 6",
    "• Pension : environ 120 à 140 ₪ par jour, selon l'endroit qui accueille le chien. La conseillère vous rappellera avec les prix exacts",
    "• Dressage intensif et dressage en pension : selon le diagnostic, paiement en plusieurs fois possible",
  ].join("\n"),
  ar: [
    "الأسعار باختصار:",
    "• استشارة هاتفية: مجانًا",
    "• تشخيص في البيت: 350 ₪، تُخصم إذا استمريتم بالتدريب",
    "• دروس خاصة: 350 ₪ للجلسة الواحدة، أو 300 ₪ للجلسة ضمن رزمة من 6 جلسات على الأقل",
    "• فندقة (بنسيون): حوالي 120 إلى 140 ₪ لليوم، حسب المكان الذي يستقبل الكلب. الممثلة ستعود إليكم بأسعار دقيقة",
    "• تدريب مكثف وتدريب في البنسيون: حسب التشخيص، ويمكن التقسيط",
  ].join("\n"),
};

/** "מחר בבוקר" / "בהקדם" / "אחרי השבת"… → the same in the customer's language. */
export function callbackWhenIn(lang: Exclude<BotLang, "he">, when: string): string {
  const w = when.trim();
  const map: Record<string, Record<Exclude<BotLang, "he">, string>> = {
    soon: { en: "soon", ru: "в ближайшее время", fr: "rapidement", ar: "قريبًا" },
    בהקדם: { en: "soon", ru: "в ближайшее время", fr: "rapidement", ar: "قريبًا" },
    after_shabbat: { en: "after Shabbat", ru: "после субботы", fr: "après Shabbat", ar: "بعد السبت" },
    "אחרי השבת": { en: "after Shabbat", ru: "после субботы", fr: "après Shabbat", ar: "بعد السبت" },
    after_holiday: { en: "after the holiday", ru: "после праздника", fr: "après la fête", ar: "بعد العيد" },
    "אחרי החג": { en: "after the holiday", ru: "после праздника", fr: "après la fête", ar: "بعد العيد" },
    "היום בבוקר": { en: "this morning", ru: "сегодня утром", fr: "ce matin", ar: "اليوم صباحًا" },
    "מחר בבוקר": { en: "tomorrow morning", ru: "завтра утром", fr: "demain matin", ar: "غدًا صباحًا" },
    "ביום ראשון בבוקר": { en: "on Sunday morning", ru: "в воскресенье утром", fr: "dimanche matin", ar: "يوم الأحد صباحًا" },
  };
  return (map[w] ?? map.soon)[lang];
}

/** Transition + closing in one message (Hebrew = closingWithTransition(closingText(…))). */
export function closingIn(lang: Exclude<BotLang, "he">, when: string, opts: { transition: boolean; serious?: boolean }): string {
  const back = callbackWhenIn(lang, when);
  const t = {
    en: {
      transition: "I'm passing all the details to a representative. She'll explain the programs and options, and together you'll decide if and which professional trainer fits.",
      closing: `${opts.serious ? "" : "Great, "}I've got everything 🙏 An AllDog representative will call you back ${back}. If anything else comes up, you can write to me here`,
    },
    ru: {
      transition: "Я передаю все детали представителю. Она расскажет о программах и вариантах, и вместе вы решите, какой профессиональный кинолог подойдёт.",
      closing: `${opts.serious ? "" : "Отлично, "}я всё записал 🙏 Представитель AllDog перезвонит вам ${back}. Если появится что-то ещё, можно написать мне здесь`,
    },
    fr: {
      transition: "Je transmets tous les détails à une conseillère. Elle vous expliquera les programmes et les options, et vous déciderez ensemble quel éducateur convient.",
      closing: `${opts.serious ? "" : "Parfait, "}j'ai tout noté 🙏 Une conseillère AllDog vous rappellera ${back}. Si quelque chose d'autre vous vient, vous pouvez m'écrire ici`,
    },
    ar: {
      transition: "أنا أنقل كل التفاصيل للممثلة. هي ستشرح لك البرامج والمسارات، وتقررون معًا أي مدرب محترف يناسب.",
      closing: `${opts.serious ? "" : "ممتاز، "}سجلت كل شيء 🙏 ممثلة AllDog ستتصل بك ${back}. إذا في شيء آخر، ممكن تكتب لي هنا`,
    },
  }[lang];
  const closing = opts.transition ? t.closing.replace(/^(?:Great|Отлично|Parfait|ممتاز)[,،]\s*/u, "").replace(/^./u, (c) => c.toUpperCase()) : t.closing;
  return opts.transition ? `${t.transition} ${closing}` : closing;
}

/** Markers of a translated closing (the bot never repeats it). */
export const FOREIGN_CLOSING_MARKERS = ["I've got everything", "я всё записал", "j'ai tout noté", "سجلت كل شيء"];
/** Markers of a translated transition (sent once per conversation). */
export const FOREIGN_TRANSITION_MARKERS = ["explain the programs and options", "расскажет о программах", "expliquera les programmes", "ستشرح لك البرامج"];

/** Item 31 fallback, translated (Hebrew = botFallbackText). */
export const FALLBACK: Record<Exclude<BotLang, "he">, string> = {
  en: "Thanks! We got your message, a representative will get back to you soon 🙏",
  ru: "Спасибо! Мы получили ваше сообщение, представитель скоро свяжется с вами 🙏",
  fr: "Merci ! Nous avons bien reçu votre message, une conseillère vous recontactera rapidement 🙏",
  ar: "شكرًا! وصلتنا رسالتك، ممثلة ستعود إليك قريبًا 🙏",
};

/** Partial closing (Or 27/10), translated (Hebrew = partialClosingText). */
export function partialClosingIn(lang: Exclude<BotLang, "he">, when: string, firstName: string | null): string {
  const back = callbackWhenIn(lang, when);
  const lead = firstName ? `${firstName}, ` : "";
  const t = {
    en: `${lead}I'm passing your message to a representative who'll call you back ${back}. If you want to add anything, write to me here and I'll update her 🙂`,
    ru: `${lead}я передаю ваше обращение представителю, она перезвонит ${back}. Если захотите что-то добавить, напишите мне здесь 🙂`,
    fr: `${lead}je transmets votre demande à une conseillère qui vous rappellera ${back}. Si vous voulez ajouter quelque chose, écrivez-moi ici 🙂`,
    ar: `${lead}أنا أنقل طلبك للممثلة وهي ستتصل بك ${back}. إذا بدك تضيف شيء، اكتب لي هنا 🙂`,
  }[lang];
  return t;
}

// ─── The next question when a reply has none (item 42: a reply without a question kills the chat) ───

export type MissingDetail = "dog_name" | "city" | "breed_age" | "problem";

const NEXT_QUESTIONS: Record<BotLang, Record<MissingDetail, string>> = {
  he: {
    problem: "מה הכי מפריע לך כרגע אצל הכלב?",
    dog_name: "איך קוראים לכלב?",
    city: "באיזו עיר?",
    breed_age: "איזה גזע הוא, ובן כמה?",
  },
  en: { problem: "What's bothering you most with the dog right now?", dog_name: "What's your dog's name?", city: "Which city are you in?", breed_age: "What breed is he, and how old?" },
  ru: { problem: "Что сейчас больше всего беспокоит в поведении собаки?", dog_name: "Как зовут собаку?", city: "В каком вы городе?", breed_age: "Какая порода и сколько лет собаке?" },
  fr: { problem: "Qu'est-ce qui vous dérange le plus chez votre chien en ce moment ?", dog_name: "Comment s'appelle votre chien ?", city: "Dans quelle ville habitez-vous ?", breed_age: "Quelle race, et quel âge a-t-il ?" },
  ar: { problem: "شو أكثر شيء مزعج عند الكلب حاليًا؟", dog_name: "شو اسم الكلب؟", city: "في أي مدينة؟", breed_age: "شو نوعه وكم عمره؟" },
};

/** The question for the first missing basic, in order problem → dog name → city → breed + age. null = nothing missing. */
export function nextQuestionFor(lang: BotLang, missing: MissingDetail[]): string | null {
  const order: MissingDetail[] = ["problem", "dog_name", "city", "breed_age"];
  const first = order.find((m) => missing.includes(m));
  return first ? NEXT_QUESTIONS[lang][first] : null;
}

/** What is still missing, from what the conversation / lead already has. Pure. */
export function missingBasics(known: { problem: boolean; dogName: boolean; city: boolean; breedAge: boolean }): MissingDetail[] {
  const out: MissingDetail[] = [];
  if (!known.problem) out.push("problem");
  if (!known.dogName) out.push("dog_name");
  if (!known.city) out.push("city");
  if (!known.breedAge) out.push("breed_age");
  return out;
}

/**
 * A reply before the closing must end with a question (9703, 8040 — 2 & 5/11: an answer without a
 * question got no reminder and the customer never wrote again). Appends `question` when the
 * reply has no "?" at all. Pure.
 */
export function ensureEndsWithQuestion(reply: string, question: string | null): string {
  if (!question || !reply.trim() || reply.includes("?") || reply.includes("؟")) return reply;
  return `${reply.trim()}\n\n${question}`;
}

// ─── Context note ────────────────────────────────────────────────────────────

/** Trainers' languages (Or, 6/11), for the prompt and the context note. */
export const TRAINER_LANGUAGES_NOTE =
  "השיעורים יכולים להיות בעברית או באנגלית. יש אצלנו גם מאלפים דוברי רוסית וצרפתית, אבל צריך לבדוק שהם זמינים לאילוף, אז לא מבטיחים מאלף בשפה מסוימת: הנציגה תבדוק ותחזור.";

/** Context note for a non-Hebrew conversation. null for Hebrew. */
export function languageNote(lang: BotLang, gender: Gender = "unknown"): string | null {
  if (lang === "he") return null;
  const name = LANG_LABEL_HE[lang];
  void gender;
  return [
    `הלקוח כותב ב${name}. כל ההודעות שלך בשיחה הזו ב${name} בלבד, כולל המחירים (מחירים עם ₪). לא מערבבים עברית.`,
    "את הפתיחה, רשימת המחירים והודעת הסגירה המערכת מוסיפה בשפה של הלקוח: לא כותבים אותן בעצמך ולא מתנצלים על הודעות קודמות.",
    lang === "ar"
      ? "השיעורים עצמם בעברית או באנגלית. לא מבטיחים מאלף דובר ערבית: הנציגה תבדוק."
      : TRAINER_LANGUAGES_NOTE,
  ].join(" ");
}

/** The journal fact for the rep (Hebrew). */
export function languageFact(lang: BotLang): string | null {
  if (lang === "he") return null;
  return `הלקוח כותב ב${LANG_LABEL_HE[lang]} – לבדוק מאלף שמדבר ${lang === "ar" ? "אנגלית / ערבית" : LANG_LABEL_HE[lang]}`;
}
