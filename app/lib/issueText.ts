/**
 * English wording for the per-word explanations returned by the backend.
 *
 * The backend (backend/model_adapter.py) writes each explanation in Arabic
 * from fixed templates, using fixed Arabic names for the articulation
 * attributes (sifat) and their values. This module maps those known names to
 * English so the English UI does not show Arabic explanations. Anything it
 * does not recognise is returned unchanged (never guessed).
 */

const TITLES: Record<string, string> = {
  "صوت زائد": "Extra sound",
  "الهمس والجهر": "Whispered vs voiced (hams / jahr)",
  "الشدة والرخاوة": "Stop vs flow (shidda / rakhawa)",
  "التفخيم والترقيق": "Heavy vs light (tafkheem / tarqeeq)",
  "الإطباق والانفتاح": "Closed vs open (itbaq / infitah)",
  "الصفير": "Whistling sound (safeer)",
  "القلقلة": "Echo sound (qalqalah)",
  "التكرار (الراء)": "Trill of the letter ر (takrar)",
  "التفشي (الشين)": "Spreading of the letter ش (tafashshi)",
  "الاستطالة (الضاد)": "Elongation of the letter ض (istitalah)",
  "الغنة": "Nasal sound (ghunnah)",
};

const VALUES: Record<string, string> = {
  "مهموس": "whispered (hams)",
  "مجهور": "voiced (jahr)",
  "شديد": "strong stop (shadeed)",
  "بين الشدة والرخاوة": "between stop and flow",
  "رخو": "flowing (rikhw)",
  "مفخم": "heavy (mufakham)",
  "مرقق": "light (muraqqaq)",
  "مفخم قليلاً": "slightly heavy",
  "منفتح": "open (monfateh)",
  "مطبق": "closed (motbaq)",
  "فيه صفير": "with whistling",
  "بدون صفير": "without whistling",
  "فيه قلقلة": "with qalqalah",
  "بدون قلقلة": "without qalqalah",
  "فيه تكرار": "with trilling",
  "بدون تكرار": "without trilling",
  "فيه تفشي": "with spreading",
  "بدون تفشي": "without spreading",
  "فيه استطالة": "with elongation",
  "بدون استطالة": "without elongation",
  "بغنة": "with ghunnah",
  "بدون غنة": "without ghunnah",
  "[PAD]": "no clear sound",
};

const QUOTED = /«(.+?)»/g;

export function localizeIssue(
  title: string | null,
  description: string | null,
  isArabic: boolean,
): { title: string | null; description: string | null } {
  if (isArabic) return { title, description };

  const enTitle = title ? (TITLES[title] ?? title) : title;
  if (!description) return { title: enTitle, description };

  const quoted = Array.from(description.matchAll(QUOTED)).map((m) => m[1]);

  // "An extra sound that is not in the text"
  if (title === "صوت زائد" && quoted.length === 1) {
    return {
      title: enTitle,
      description: `A sound “${quoted[0]}” was heard that is not in the text.`,
    };
  }

  // "Expected X but heard Y"
  if (quoted.length === 2 && description.includes("المتوقع")) {
    const expected = VALUES[quoted[0]] ?? quoted[0];
    const heard = VALUES[quoted[1]] ?? quoted[1];
    return {
      title: enTitle,
      description: `Expected “${expected}” but heard “${heard}”.`,
    };
  }

  return { title: enTitle, description };
}
