"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import SurahList from "./components/SurahList";
import QuranReader from "./components/QuranReader";

export type Surah = {
  number: number;
  arabic: string;
  english: string;
};

export default function Home() {
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);

  return (
    <main className="min-h-screen bg-[#f7f6f0]">
      {/* صفحة اختيار السورة */}
      {!selectedSurah && (
        <div className="flex min-h-screen">
          {/* نخفي الـ Sidebar في الجوال */}
          <div className="hidden md:block">
            <Sidebar />
          </div>

          <SurahList
            selectedSurah={0}
            onSelectSurah={(surah: Surah) => {
              setSelectedSurah(surah);
            }}
          />

          {/* المساحة الموجودة يمين القائمة في الكمبيوتر */}
          <section className="hidden flex-1 items-center justify-center bg-[#f7f6f0] lg:flex">
            <div className="text-center">
              <div className="mb-5 text-6xl">📖</div>

              <h1 className="text-4xl font-bold text-[#123d35]">
                Tajweed Coach
              </h1>

              <p className="mt-3 text-lg text-gray-500">
                Select a Surah to start practicing.
              </p>
            </div>
          </section>
        </div>
      )}

      {/* صفحة قراءة السورة */}
      {selectedSurah && (
        <QuranReader
          surahNumber={selectedSurah.number}
          surahName={selectedSurah.arabic}
          englishName={selectedSurah.english}
          onBack={() => setSelectedSurah(null)}
        />
      )}
    </main>
  );
}