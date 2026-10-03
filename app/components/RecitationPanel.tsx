"use client";

import { useEffect, useRef, useState } from "react";
import {
  analysisSupported,
  analyzeRecitation,
  type AnalysisResult,
  type AnalyzedWord,
  BackendError,
} from "../lib/backend";

type RecitationPanelProps = {
  surahNumber: number;
  isArabic: boolean;
};

type Stage = "idle" | "recording" | "analyzing" | "done" | "error";

// Scope decision (3 Oct 2026): automatic analysis is limited to Juz Amma
// (surahs 78-114) - short surahs, the first thing most learners study, and
// a small enough surface to verify end to end (see backend/validate_scope.py).
// The mushaf viewer still shows every surah for reading.
const JUZ_AMMA_FIRST_SURAH = 78;
const JUZ_AMMA_LAST_SURAH = 114;

// Raw shape returned by our own /api/quran route (see app/api/quran/route.ts).
// textUthmani is the plain, phonetizable Arabic text (what the backend needs
// to compare against) - separate from codeV2, which is only a font-specific
// glyph code used to render the mushaf page and is NOT real text.
type RawWord = {
  id: number;
  position: number;
  charTypeName: string;
  text?: string;
  codeV2?: string;
  textUthmani?: string;
};

type RawAyah = {
  id: number;
  verseNumber: number;
  verseKey: string;
  words: RawWord[];
};

const STATUS_LABEL_AR: Record<string, string> = {
  correct: "صحيح",
  warn: "يحتاج تحسين",
  error: "خطأ",
};

const STATUS_LABEL_EN: Record<string, string> = {
  correct: "Correct",
  warn: "Needs work",
  error: "Error",
};

const STATUS_STYLES: Record<string, string> = {
  correct: "border-[#bfe3d3] bg-[#e1f1eb] text-[#187762]",
  warn: "border-[#f3d9a6] bg-[#fdf3e2] text-[#8a5a00]",
  error: "border-[#f3c2c2] bg-[#fde9e9] text-[#b42318]",
};

export default function RecitationPanel({
  surahNumber,
  isArabic,
}: RecitationPanelProps) {
  const inScope =
    surahNumber >= JUZ_AMMA_FIRST_SURAH && surahNumber <= JUZ_AMMA_LAST_SURAH;

  // Every ayah of the current surah, loaded once per surah. This is the
  // SAME /api/quran route the mushaf viewer (QuranText) uses, just also
  // asking for textUthmani (plain, phonetizable text) alongside codeV2
  // (the font glyph code QuranText renders with) - so recitation analysis
  // is no longer limited to the one ayah hardcoded server-side before.
  const [surahAyahs, setSurahAyahs] = useState<RawAyah[]>([]);
  const [surahLoadError, setSurahLoadError] = useState<string | null>(null);
  const [selectedAyah, setSelectedAyah] = useState(1);

  const [stage, setStage] = useState<Stage>("idle");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  function logDebug(msg: string) {
    const line = `${new Date().toLocaleTimeString()} ${msg}`;
    setDebugLog((prev) => [...prev.slice(-7), line]);
  }

  // Load every ayah of the surah once (same data source the mushaf page
  // already uses), so the learner can pick ANY ayah to practice instead of
  // being stuck on one hardcoded ayah.
  useEffect(() => {
    let cancelled = false;
    setSurahLoadError(null);
    setSelectedAyah(1);

    if (surahNumber < JUZ_AMMA_FIRST_SURAH || surahNumber > JUZ_AMMA_LAST_SURAH) {
      setSurahAyahs([]);
      return;
    }

    fetch(`/api/quran?surah=${surahNumber}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load surah");
        return res.json();
      })
      .then((result: RawAyah[]) => {
        if (!cancelled) setSurahAyahs(result);
      })
      .catch(() => {
        if (!cancelled) {
          setSurahAyahs([]);
          setSurahLoadError(
            "تعذر تحميل نص السورة. تأكد من اتصال الإنترنت وحاول مرة أخرى."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [surahNumber]);

  // Always release the microphone, even if the component unmounts mid-
  // recording (e.g. the user navigates back to the surah list).
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const totalAyat = surahAyahs.length;
  const currentRawAyah = surahAyahs.find((a) => a.verseNumber === selectedAyah);

  // Only real recited words carry phonetizable text - charTypeName "word".
  // Other entries (e.g. the ayah-end ornament glyph) are display-only and
  // have no textUthmani worth sending to the backend.
  const currentWords: AnalyzedWord[] = (currentRawAyah?.words ?? [])
    .filter((w) => w.charTypeName === "word" && w.textUthmani)
    .map((w) => ({
      id: String(w.id),
      text: w.textUthmani as string,
      status: null,
      issue_title: null,
      issue_description: null,
    }));

  const supported = inScope && analysisSupported(currentWords);

  function goToAyah(next: number) {
    if (next < 1 || next > totalAyat) return;
    setSelectedAyah(next);
    setAnalysis(null);
    setErrorMessage(null);
    setStage("idle");
  }

  async function startRecording() {
    setErrorMessage(null);
    setAnalysis(null);
    logDebug(`startRecording() called (ayah ${selectedAyah})`);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMessage(
        "تعذر الوصول إلى الميكروفون. تأكد من إعطاء إذن المتصفح للوصول للميكروفون."
      );
      setStage("error");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const preferredMimeType = "audio/webm";
    const mimeType =
      typeof MediaRecorder.isTypeSupported === "function" &&
      MediaRecorder.isTypeSupported(preferredMimeType)
        ? preferredMimeType
        : undefined;

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      logDebug("recorder.onstop fired");
      void handleRecordingStopped(recorder.mimeType);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setStage("recording");
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function handleRecordingStopped(mimeType: string) {
    const blob = new Blob(chunksRef.current, {
      type: mimeType || "audio/webm",
    });
    chunksRef.current = [];
    logDebug(`handleRecordingStopped: blob size=${blob.size} type=${mimeType}`);

    if (blob.size === 0) {
      setErrorMessage("لم يتم تسجيل أي صوت. حاول مرة أخرى.");
      setStage("error");
      return;
    }

    setStage("analyzing");
    logDebug(`calling analyzeRecitation() for ayah ${selectedAyah} (${currentWords.length} words)...`);
    try {
      const result = await analyzeRecitation(
        surahNumber,
        selectedAyah,
        blob,
        currentWords.map((w) => ({ id: w.id, text: w.text }))
      );
      logDebug(`got result: score=${result.score}`);
      setAnalysis(result);
      setStage("done");
    } catch (err) {
      logDebug(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      setErrorMessage(
        err instanceof BackendError
          ? err.message
          : "حدث خطأ غير متوقع أثناء تحليل التلاوة."
      );
      setStage("error");
    }
  }

  function handleMicClick() {
    if (!supported) return;
    if (stage === "recording") {
      stopRecording();
      return;
    }
    void startRecording();
  }

  const displayWords = analysis?.words ?? currentWords;

  return (
    <>
      {/* Recitation */}
      <section className="mt-5 rounded-[28px] border border-[#e4e0d5] bg-white p-6 text-center shadow-sm md:p-8">
        {/* Ayah picker - lets the learner practice whichever ayah they want,
            not just one hardcoded ayah. */}
        {inScope && totalAyat > 0 && (
          <div className="mb-4 flex items-center justify-center gap-3">
            <button
              onClick={() => goToAyah(selectedAyah - 1)}
              disabled={selectedAyah <= 1}
              className="rounded-full bg-[#f1efe6] px-3 py-1 text-sm font-bold text-[#187762] transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={isArabic ? "الآية السابقة" : "Previous ayah"}
            >
              {isArabic ? "◀" : "◁"}
            </button>

            <p className="text-sm font-semibold text-gray-600">
              {isArabic
                ? `الآية ${selectedAyah} من ${totalAyat}`
                : `Ayah ${selectedAyah} of ${totalAyat}`}
            </p>

            <button
              onClick={() => goToAyah(selectedAyah + 1)}
              disabled={selectedAyah >= totalAyat}
              className="rounded-full bg-[#f1efe6] px-3 py-1 text-sm font-bold text-[#187762] transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={isArabic ? "الآية التالية" : "Next ayah"}
            >
              {isArabic ? "▶" : "▷"}
            </button>
          </div>
        )}

        {!inScope && (
          <p className="mb-4 text-sm font-semibold text-gray-500">
            {isArabic
              ? "التحليل الآلي متاح حاليًا لجزء عمّ (السور 78–114) — نسخة تجريبية أولى."
              : "Automatic analysis is currently available for Juz Amma (surahs 78–114) — early preview."}
          </p>
        )}

        {inScope && !supported && !surahLoadError && (
          <p className="mb-4 text-sm font-semibold text-gray-500">
            {isArabic
              ? "جاري تحميل نص الآية..."
              : "Loading ayah text..."}
          </p>
        )}

        {supported && (
          <p className="mb-4 text-sm font-semibold text-gray-500">
            {stage === "recording"
              ? isArabic
                ? "جاري التسجيل... اضغط مرة أخرى للإيقاف"
                : "Recording... tap again to stop"
              : stage === "analyzing"
                ? isArabic
                  ? "جاري تحليل التلاوة..."
                  : "Analyzing your recitation..."
                : isArabic
                  ? "جاهز للتلاوة؟"
                  : "Ready to recite?"}
          </p>
        )}

        <button
          onClick={handleMicClick}
          disabled={!supported || stage === "analyzing"}
          aria-label={
            stage === "recording" ? "Stop recording" : "Start recording"
          }
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl text-white shadow-lg transition md:h-24 md:w-24 ${
            !supported || stage === "analyzing"
              ? "cursor-not-allowed bg-gray-300"
              : stage === "recording"
                ? "animate-pulse bg-[#b42318] hover:bg-[#942018]"
                : "bg-[#187762] hover:scale-105 hover:bg-[#125f4e]"
          }`}
        >
          {stage === "analyzing" ? "⏳" : stage === "recording" ? "⏹️" : "🎙️"}
        </button>

        <h3 className="mt-4 text-lg font-bold md:text-xl">
          {stage === "recording"
            ? isArabic
              ? "إيقاف التسجيل"
              : "Stop Recording"
            : isArabic
              ? "ابدأ التلاوة"
              : "Start Reciting"}
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          {supported
            ? isArabic
              ? "اضغط على المايك عندما تكون مستعدًا"
              : "Tap the microphone when you're ready"
            : !inScope
              ? isArabic
                ? "اختر سورة من جزء عمّ لتجربة التحليل الآلي"
                : "Pick a Juz Amma surah to try automatic analysis"
              : isArabic
                ? "انتظر تحميل نص الآية"
                : "Waiting for ayah text to load"}
        </p>

        {errorMessage && (
          <p className="mt-4 rounded-xl bg-[#fde9e9] px-4 py-3 text-sm font-semibold text-[#b42318]">
            {errorMessage}
          </p>
        )}

        {surahLoadError && !errorMessage && (
          <p className="mt-4 rounded-xl bg-[#fde9e9] px-4 py-3 text-sm font-semibold text-[#b42318]">
            {surahLoadError}
          </p>
        )}

        {debugLog.length > 0 && (
          <div
            dir="ltr"
            className="mt-4 rounded-xl bg-gray-100 px-4 py-3 text-left text-xs text-gray-700"
          >
            <p className="mb-1 font-bold">Debug (temporary):</p>
            {debugLog.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </section>

      {/* Tajweed Feedback */}
      <section className="mt-5 rounded-[28px] border border-[#e4e0d5] bg-white p-6 shadow-sm md:p-8">
        <div dir={isArabic ? "rtl" : "ltr"} className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#187762]">
            AI Analysis
          </p>

          <h3 className="mt-1 text-xl font-bold md:text-2xl">
            {isArabic ? "تحليل التجويد" : "Tajweed Feedback"}
          </h3>

          <p className="mt-2 text-sm text-gray-500">
            {analysis
              ? isArabic
                ? `النتيجة: ${analysis.score}% — صحيح: ${analysis.correct_count}، يحتاج تحسين: ${analysis.warn_count}، خطأ: ${analysis.error_count}`
                : `Score: ${analysis.score}% — correct: ${analysis.correct_count}, needs work: ${analysis.warn_count}, errors: ${analysis.error_count}`
              : isArabic
                ? "ستظهر نتائج تحليل تلاوتك هنا."
                : "Your recitation analysis will appear here."}
          </p>
        </div>

        {displayWords.length === 0 ? (
          <p className="text-sm text-gray-400">
            {isArabic ? "لا توجد بيانات بعد." : "No data yet."}
          </p>
        ) : (
          <div
            dir="rtl"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {displayWords.map((word) => (
              <WordFeedbackCard
                key={word.id}
                word={word}
                isArabic={isArabic}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function WordFeedbackCard({
  word,
  isArabic,
}: {
  word: AnalyzedWord;
  isArabic: boolean;
}) {
  const status = word.status ?? null;
  const style = status
    ? STATUS_STYLES[status]
    : "border-[#e4e0d5] bg-[#f7f6f0] text-gray-500";
  const label = status
    ? isArabic
      ? STATUS_LABEL_AR[status]
      : STATUS_LABEL_EN[status]
    : isArabic
      ? "بانتظار التلاوة"
      : "Waiting";

  return (
    <div className={`rounded-2xl border p-4 text-right ${style}`}>
      <p dir="rtl" className="text-lg font-bold">
        {word.text}
      </p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
      {word.issue_title && (
        <p className="mt-1 text-xs font-bold">{word.issue_title}</p>
      )}
      {word.issue_description && (
        <p className="mt-1 text-xs leading-relaxed opacity-90">
          {word.issue_description}
        </p>
      )}
    </div>
  );
}
