/**
 * Typed client for the Tajweed Coach FastAPI backend (see ../../backend).
 *
 * The backend URL is read from NEXT_PUBLIC_BACKEND_URL (set it in
 * .env.local) and falls back to http://localhost:8000 for local dev,
 * which matches `uvicorn main:app --reload --port 8000` from
 * backend/README.md.
 *
 * Scope note (updated): analysis is no longer limited to one hardcoded
 * ayah. The frontend fetches full Uthmani text for any ayah itself (via
 * our own /api/quran route - see RecitationPanel.tsx) and sends that
 * ayah's words straight to POST /api/analyze alongside the audio, so the
 * backend doesn't need its own per-ayah reference data to analyze
 * whatever ayah the learner chose to recite. analysisSupported() just
 * checks that we actually have a non-empty word list to send.
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

export type AnalysisResult = {
  score: number;
  correct_count: number;
  warn_count: number;
  error_count: number;
  words: AnalyzedWord[];
};

export class BackendError extends Error {}

/**
 * Fire-and-forget ping that wakes the (serverless) analysis backend as soon as
 * the page opens, so the model is already loaded when the learner finishes
 * recording. Failures are ignored on purpose.
 */
export function warmUpBackend() {
  fetch(`${BACKEND_URL}/health`, { cache: "no-store" }).catch(() => {});
}

/** True as long as we have real ayah text to send for analysis. */
export function analysisSupported(words: { id: string; text: string }[]) {
  return words.length > 0;
}

export async function analyzeRecitation(
  surahNumber: number,
  ayahNumber: number,
  audioBlob: Blob,
  words: { id: string; text: string }[]
): Promise<AnalysisResult> {
  const form = new FormData();
  const extension = audioBlob.type.includes("webm") ? "webm" : "wav";
  form.append("audio", audioBlob, `recitation.${extension}`);
  form.append("words", JSON.stringify(words));

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
      throw new BackendError("لم يتم تسجيل أي صوت، أو بيانات الآية ناقصة. حاول مرة أخرى.");
    }
    throw new BackendError("حدث خطأ أثناء تحليل التلاوة.");
  }

  return response.json();
}
