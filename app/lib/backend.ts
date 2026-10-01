/**
 * Typed client for the Tajweed Coach FastAPI backend (see ../../backend).
 *
 * The backend URL is read from NEXT_PUBLIC_BACKEND_URL (set it in
 * .env.local) and falls back to http://localhost:8000 for local dev,
 * which matches `uvicorn main:app --reload --port 8000` from
 * backend/README.md.
 *
 * Scope note: the backend only has Al-Fatiha ayah 1 (the Basmala) seeded
 * in reference_data.py right now - that's a known, documented gap (see
 * tajweed-coach-decisions.md), not a bug here. ANALYSIS_SUPPORTED() below
 * is the single source of truth the UI uses to decide when to offer
 * recording/analysis vs. show a "not available yet" state, so this stays
 * correct automatically once more ayat are added server-side.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ||
  "http://localhost:8000";

export type WordStatus = "correct" | "warn" | "error";

export type AnalyzedWord = {
  id: string;
  text: string;
  status: WordStatus | null;
  issue_title: string | null;
  issue_description: string | null;
};

export type AyahData = {
  surah_number: number;
  surah_name_ar: string;
  ayah_number: number;
  total_ayat: number;
  words: AnalyzedWord[];
};

export type AnalysisResult = {
  score: number;
  correct_count: number;
  warn_count: number;
  error_count: number;
  words: AnalyzedWord[];
};

export class BackendError extends Error {}

/** Only Al-Fatiha (1), ayah 1 is seeded server-side for now. */
export function analysisSupported(surahNumber: number, ayahNumber: number) {
  return surahNumber === 1 && ayahNumber === 1;
}

export async function fetchAyah(
  surahNumber: number,
  ayahNumber: number
): Promise<AyahData> {
  let response: Response;
  try {
    response = await fetch(
      `${BACKEND_URL}/api/ayah/${surahNumber}/${ayahNumber}`
    );
  } catch {
    throw new BackendError(
      "تعذر الوصول لخادم التحليل. تأكد إن الباكند شغّال (uvicorn على المنفذ 8000)."
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new BackendError("هذه الآية غير متوفرة بعد في محرك التحليل.");
    }
    throw new BackendError("تعذر تحميل بيانات الآية من خادم التحليل.");
  }

  return response.json();
}

export async function analyzeRecitation(
  surahNumber: number,
  ayahNumber: number,
  audioBlob: Blob
): Promise<AnalysisResult> {
  const form = new FormData();
  const extension = audioBlob.type.includes("webm") ? "webm" : "wav";
  form.append("audio", audioBlob, `recitation.${extension}`);

  let response: Response;
  try {
    response = await fetch(
      `${BACKEND_URL}/api/analyze?surah=${surahNumber}&ayah=${ayahNumber}`,
      { method: "POST", body: form }
    );
  } catch {
    throw new BackendError(
      "تعذر الوصول لخادم التحليل. تأكد إن الباكند شغّال (uvicorn على المنفذ 8000)."
    );
  }

  if (!response.ok) {
    if (response.status === 400) {
      throw new BackendError("لم يتم تسجيل أي صوت. حاول مرة أخرى.");
    }
    if (response.status === 404) {
      throw new BackendError("هذه الآية غير متوفرة بعد في محرك التحليل.");
    }
    throw new BackendError("حدث خطأ أثناء تحليل التلاوة.");
  }

  return response.json();
}
