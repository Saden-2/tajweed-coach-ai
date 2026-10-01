"use client";

import { useEffect, useRef, useState } from "react";
import {
  analysisSupported,
  analyzeRecitation,
  fetchAyah,
  type AnalysisResult,
  type AnalyzedWord,
  BackendError,
} from "../lib/backend";

type RecitationPanelProps = {
  surahNumber: number;
  isArabic: boolean;
};

type Stage = "idle" | "recording" | "analyzing" | "done" | "error";

// Only Al-Fatiha ayah 1 is wired server-side for now (see backend's
// reference_data.py + tajweed-coach-decisions.md). Hardcoding it here
// keeps the scope explicit instead of guessing which ayah the mushaf
// page viewer happens to be showing.
const ANALYSIS_AYAH = 1;

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
  const supported = analysisSupported(surahNumber, ANALYSIS_AYAH);

  const [ayahWords, setAyahWords] = useState<AnalyzedWord[] | null>(null);
  const [ayahLoadError, setAyahLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Load the reference ayah (for the baseline word list) once we land on
  // a surah/ayah combination the backend actually supports.
  useEffect(() => {
    if (!supported) {
      setAyahWords(null);
      return;
    }

    let cancelled = false;
    setAyahLoadError(null);

    fetchAyah(surahNumber, ANALYSIS_AYAH)
      .then((ayah) => {
        if (!cancelled) setAyahWords(ayah.words);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAyahWords(null);
        setAyahLoadError(
          err instanceof BackendError
            ? err.message
            : "تعذر تحميل بيانات الآية من خادم التحليل."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [supported, surahNumber]);

  // Always release the microphone, even if the component unmounts mid-
  // recording (e.g. the user navigates back to the surah list).
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    setErrorMessage(null);
    setAnalysis(null);

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

    if (blob.size === 0) {
      setErrorMessage("لم يتم تسجيل أي صوت. حاول مرة أخرى.");
      setStage("error");
      return;
    }

    setStage("analyzing");
    try {
      const result = await analyzeRecitation(
        surahNumber,
        ANALYSIS_AYAH,
        blob
      );
      setAnalysis(result);
      setStage("done");
    } catch (err) {
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

  const displayWords = analysis?.words ?? ayahWords ?? [];

  return (
    <>
      {/* Recitation */}
      <section className="mt-5 rounded-[28px] border border-[#e4e0d5] bg-white p-6 text-center shadow-sm md:p-8">
        {!supported && (
          <p className="mb-4 text-sm font-semibold text-gray-500">
            {isArabic
              ? "تحليل التجويد الآلي متاح حاليًا فقط لسورة الفاتحة (الآية الأولى) — نسخة تجريبية أولى."
              : "Automatic tajweed analysis is currently available for Al-Fatiha, ayah 1 only — early preview."}
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
            : isArabic
              ? "اختر سورة الفاتحة لتجربة التحليل الآلي"
              : "Select Al-Fatiha to try automatic analysis"}
        </p>

        {errorMessage && (
          <p className="mt-4 rounded-xl bg-[#fde9e9] px-4 py-3 text-sm font-semibold text-[#b42318]">
            {errorMessage}
          </p>
        )}

        {ayahLoadError && !errorMessage && (
          <p className="mt-4 rounded-xl bg-[#fde9e9] px-4 py-3 text-sm font-semibold text-[#b42318]">
            {ayahLoadError}
          </p>
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
