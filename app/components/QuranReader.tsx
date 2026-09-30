"use client";

import { useState } from "react";
import QuranText from "./QuranText";
type QuranReaderProps = {
  surahNumber: number;
  surahName: string;
  englishName: string;
  onBack: () => void;
};

export default function QuranReader({
  surahNumber,
  surahName,
  englishName,
  onBack,
}: QuranReaderProps) {
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const isArabic = language === "ar";

  return (
    <div className="min-h-screen bg-[#f7f6f0] text-[#123d35]">

      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-[#e5e2d9] bg-[#f7f6f0]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">

          <button
            onClick={onBack}
            className="rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-white"
          >
            {isArabic ? "← السور" : "← Surahs"}
          </button>

          <div className="text-center">
            <h1
              dir={isArabic ? "rtl" : "ltr"}
              className="text-lg font-bold md:text-xl"
            >
              {isArabic ? `سورة ${surahName}` : englishName}
            </h1>

            <p className="text-xs text-gray-500">
              {isArabic
                ? `السورة رقم ${surahNumber}`
                : `Surah ${surahNumber}`}
            </p>
          </div>

          {/* Language */}
          <div className="flex rounded-xl bg-white p-1 shadow-sm">
            <button
              onClick={() => setLanguage("ar")}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                isArabic
                  ? "bg-[#187762] text-white"
                  : "text-gray-500"
              }`}
            >
              عربي
            </button>

            <button
              onClick={() => setLanguage("en")}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                !isArabic
                  ? "bg-[#187762] text-white"
                  : "text-gray-500"
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">

        {/* Surah information */}
        <section className="mb-5 text-center">
          <p className="text-sm font-semibold text-[#187762]">
            {isArabic
              ? `سورة ${surahName}`
              : englishName}
          </p>

          <h2
            dir="rtl"
            className="mt-2 text-3xl font-bold md:text-4xl"
          >
            {surahName}
          </h2>
        </section>

        {/* Quran */}
        <section className="rounded-[28px] border border-[#e4e0d5] bg-white px-5 py-10 shadow-sm md:px-12 md:py-14">

          <div className="mx-auto max-w-3xl text-center">

           <p
            dir="rtl"
            className="mb-10 text-2xl leading-[2.4] text-[#123d35] md:text-3xl"
>
             بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
</p>
          <QuranText surahNumber={surahNumber} />

            {/* مؤقتًا إلى أن نربط بيانات القرآن */}
            <div
              dir={isArabic ? "rtl" : "ltr"}
              className="rounded-2xl bg-[#f7f6f0] px-5 py-8"
            >
            <QuranText surahNumber={surahNumber} />
            </div>

          </div>
        </section>

        {/* Recitation */}
        <section className="mt-5 rounded-[28px] border border-[#e4e0d5] bg-white p-6 text-center shadow-sm md:p-8">

          <p className="mb-4 text-sm font-semibold text-gray-500">
            {isArabic
              ? "جاهز للتلاوة؟"
              : "Ready to recite?"}
          </p>

          <button
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#187762] text-3xl text-white shadow-lg transition hover:scale-105 hover:bg-[#125f4e] md:h-24 md:w-24"
            aria-label="Start recording"
          >
            🎙️
          </button>

          <h3 className="mt-4 text-lg font-bold md:text-xl">
            {isArabic
              ? "ابدأ التلاوة"
              : "Start Reciting"}
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            {isArabic
              ? "اضغط على المايك عندما تكون مستعدًا"
              : "Tap the microphone when you're ready"}
          </p>
        </section>

        {/* Tajweed Feedback */}
        <section className="mt-5 rounded-[28px] border border-[#e4e0d5] bg-white p-6 shadow-sm md:p-8">

          <div
            dir={isArabic ? "rtl" : "ltr"}
            className="mb-6"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[#187762]">
              AI Analysis
            </p>

            <h3 className="mt-1 text-xl font-bold md:text-2xl">
              {isArabic
                ? "تحليل التجويد"
                : "Tajweed Feedback"}
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              {isArabic
                ? "ستظهر نتائج تحليل تلاوتك هنا."
                : "Your recitation analysis will appear here."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

            <FeedbackCard
              icon="✓"
              title={isArabic ? "النطق" : "Pronunciation"}
              status={isArabic ? "بانتظار التلاوة" : "Waiting"}
            />

            <FeedbackCard
              icon="ـ"
              title={isArabic ? "المد" : "Madd"}
              status={isArabic ? "بانتظار التلاوة" : "Waiting"}
            />

            <FeedbackCard
              icon="ن"
              title={isArabic ? "الإخفاء" : "Ikhfa"}
              status={isArabic ? "بانتظار التلاوة" : "Waiting"}
            />

            <FeedbackCard
              icon="د"
              title={isArabic ? "الإدغام" : "Idgham"}
              status={isArabic ? "بانتظار التلاوة" : "Waiting"}
            />

            <FeedbackCard
              icon="ق"
              title={isArabic ? "القلقلة" : "Qalqalah"}
              status={isArabic ? "بانتظار التلاوة" : "Waiting"}
            />

            <FeedbackCard
              icon="م"
              title={isArabic ? "الغنة" : "Ghunnah"}
              status={isArabic ? "بانتظار التلاوة" : "Waiting"}
            />

          </div>
        </section>

      </main>
    </div>
  );
}

function FeedbackCard({
  icon,
  title,
  status,
}: {
  icon: string;
  title: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-[#f7f6f0] p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e1f1eb] font-bold text-[#187762]">
        {icon}
      </div>

      <div>
        <p className="font-bold text-[#123d35]">
          {title}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {status}
        </p>
      </div>
    </div>
  );
}