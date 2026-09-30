"use client";

import { useEffect, useState } from "react";

type Word = {
  id: number;
  position: number;
  charTypeName: string;
  pageNumber: number;
  lineNumber: number;
  text?: string;
  codeV2?: string;
  textQpcHafs?: string;
};

type Ayah = {
  id: number;
  verseNumber: number;
  verseKey: string;
  pageNumber: number;
  juzNumber: number;
  words: Word[];
};

type QuranTextProps = {
  surahNumber: number;
};

export default function QuranText({ surahNumber }: QuranTextProps) {
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const [loadedPage, setLoadedPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadSurah() {
      try {
        setLoading(true);
        setError(false);

        const response = await fetch(`/api/quran?surah=${surahNumber}`);

        if (!response.ok) {
          throw new Error("Failed to load Quran");
        }

        const result: Ayah[] = await response.json();

        setAyahs(result);

        if (result.length > 0) {
          setCurrentPage(result[0].pageNumber);
        }
      } catch (error) {
        console.error(error);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadSurah();
  }, [surahNumber]);

  useEffect(() => {
    if (currentPage === null) return;

    async function loadQcfFont() {
      try {
        setLoadedPage(null);

        const fontName = `p${currentPage}-v2`;

        const fontFace = new FontFace(
          fontName,
          `url("https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${currentPage}.woff2")`
        );

        await fontFace.load();

        document.fonts.add(fontFace);

        setLoadedPage(currentPage);
      } catch (error) {
        console.error("Failed to load Quran font:", error);
      }
    }

    loadQcfFont();
  }, [currentPage]);

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500">
        جاري تحميل صفحة المصحف...
      </div>
    );
  }

  if (error || currentPage === null) {
    return (
      <div className="py-20 text-center text-red-500">
        تعذر تحميل صفحة المصحف.
      </div>
    );
  }

  const pages = [...new Set(ayahs.map((ayah) => ayah.pageNumber))];

  const pageAyahs = ayahs.filter(
    (ayah) => ayah.pageNumber === currentPage
  );

  const currentIndex = pages.indexOf(currentPage);

  const juz = pageAyahs[0]?.juzNumber;

  const words = pageAyahs.flatMap((ayah) => ayah.words);

  const lineNumbers = [
    ...new Set(words.map((word) => word.lineNumber)),
  ].sort((a, b) => a - b);

  function nextPage() {
    if (currentIndex < pages.length - 1) {
      setCurrentPage(pages[currentIndex + 1]);
    }
  }

  function previousPage() {
    if (currentIndex > 0) {
      setCurrentPage(pages[currentIndex - 1]);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6 md:px-8">

      {/* معلومات الصفحة */}
      <div
        dir="rtl"
        className="mb-5 flex items-center justify-between text-sm text-gray-500"
      >
        <span>الجزء {juz}</span>
        <span>صفحة {currentPage}</span>
      </div>

      {/* صفحة المصحف */}
      <div
        dir="rtl"
        translate="no"
        className="
          min-h-[650px]
          rounded-3xl
          border
          border-[#e5e1d8]
          bg-[#fffdf7]
          px-4
          py-10
          shadow-sm
          md:min-h-[800px]
          md:px-10
          md:py-14
        "
      >
        {loadedPage !== currentPage ? (
          <div className="py-20 text-center text-gray-400">
            جاري تحميل خط المصحف...
          </div>
        ) : (
          <div className="mx-auto max-w-4xl text-center text-[#123d35]">

            {lineNumbers.map((lineNumber) => {
              const lineWords = words.filter(
                (word) => word.lineNumber === lineNumber
              );

              return (
                <div
                  key={lineNumber}
                  dir="rtl"
                  className="
                    flex
                    min-h-[58px]
                    items-center
                    justify-center
                    gap-[2px]
                    whitespace-nowrap
                  "
                >
                  {lineWords.map((word) => {
                    const isEnd = word.charTypeName === "end";

                    if (isEnd) {
                      return (
                        <span
                          key={word.id}
                          style={{
                            fontFamily: "UthmanicHafs, serif",
                            fontSize: "30px",
                          }}
                        >
                          {word.textQpcHafs || word.text || ""}
                        </span>
                      );
                    }

                    return (
                      <span
                        key={word.id}
                        style={{
                          fontFamily: `p${currentPage}-v2`,
                          fontSize: "clamp(30px, 4vw, 44px)",
                          lineHeight: 1.7,
                        }}
                        dangerouslySetInnerHTML={{
                          __html:
                            word.codeV2 ||
                            word.textQpcHafs ||
                            word.text ||
                            "",
                        }}
                      />
                    );
                  })}

                </div>
              );
            })}

          </div>
        )}
      </div>

      {/* التنقل */}
      <div className="mt-6 flex items-center justify-between gap-3">

        <button
          onClick={previousPage}
          disabled={currentIndex === 0}
          className="
            rounded-xl
            border
            border-gray-200
            bg-white
            px-5
            py-3
            text-[#123d35]
            shadow-sm
            disabled:cursor-not-allowed
            disabled:opacity-30
          "
        >
          السابق
        </button>

        <div className="text-sm text-gray-500">
          {currentPage} / 604
        </div>

        <button
          onClick={nextPage}
          disabled={currentIndex === pages.length - 1}
          className="
            rounded-xl
            bg-[#167c68]
            px-5
            py-3
            text-white
            shadow-sm
            disabled:cursor-not-allowed
            disabled:opacity-30
          "
        >
          التالي
        </button>

      </div>
    </div>
  );
}