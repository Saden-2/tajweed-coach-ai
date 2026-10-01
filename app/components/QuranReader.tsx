"use client";

import { useState } from "react";
import QuranText from "./QuranText";
import RecitationPanel from "./RecitationPanel";

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
            <QuranText surahNumber={surahNumber} />
          </div>
        </section>

        {/* Recitation + Tajweed Feedback (wired to the backend) */}
        <RecitationPanel surahNumber={surahNumber} isArabic={isArabic} />

      </main>
    </div>
  );
}
