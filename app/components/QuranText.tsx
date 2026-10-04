"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
  surahName?: string;
};

// Text-size levels (for older readers / low vision). 1 = fit the frame.
const SCALES = [0.85, 1, 1.25, 1.5, 1.8];

const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export default function QuranText({ surahNumber, surahName }: QuranTextProps) {
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const [loadedPage, setLoadedPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scaleIdx, setScaleIdx] = useState(1);
  // "page" = exact 15-line mushaf page; "flow" = same mushaf glyphs but the
  // words wrap freely, so the text can be much larger (phones, older readers).
  const [mode, setMode] = useState<"page" | "flow">("page");

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("mushafScaleIdx"));
      if (Number.isInteger(saved) && saved >= 0 && saved < SCALES.length) {
        setScaleIdx(saved);
      }
    } catch {
      /* storage unavailable - keep the default size */
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mushafMode");
      if (saved === "page" || saved === "flow") {
        setMode(saved);
        return;
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Exact-fit mushaf page: we measure the real width of every line and pick
  // the largest font size at which the widest line fills the container, so
  // each line runs edge to edge like the printed page (any phone width).
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fitPx, setFitPx] = useState<number | null>(null);
  const [fullLines, setFullLines] = useState<number[]>([]);

  useLayoutEffect(() => {
    if (mode !== "page" || loadedPage === null) return;

    function fit() {
      const box = containerRef.current;
      if (!box) return;
      const W = box.clientWidth;
      const lines = Array.from(
        box.querySelectorAll<HTMLElement>("[data-line]")
      );
      if (!W || lines.length === 0) return;

      const measured = lines.map((el) => {
        const kids = Array.from(el.children) as HTMLElement[];
        const glyphs = kids.reduce(
          (sum, k) => sum + k.getBoundingClientRect().width,
          0
        );
        const gaps = Math.max(0, kids.length - 1) * 2; // gap-[2px]
        return { n: Number(el.dataset.line), glyphs, gaps };
      });

      const sample = box.querySelector("[data-w]");
      const current = sample
        ? parseFloat(getComputedStyle(sample).fontSize) || 28
        : 28;
      // Largest font that keeps every line within W (0.5% safety margin).
      let next = Infinity;
      for (const m of measured) {
        if (m.glyphs <= 0) continue;
        next = Math.min(next, (current * (W * 0.995 - m.gaps)) / m.glyphs);
      }
      if (!isFinite(next)) return;
      next = Math.max(14, Math.min(next, 80));

      const ratio = next / current;
      setFullLines(
        measured
          .filter((m) => m.glyphs * ratio + m.gaps >= W * 0.9)
          .map((m) => m.n)
      );
      setFitPx((prev) => (prev !== null && Math.abs(prev - next) < 0.3 ? prev : next));
    }

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [mode, loadedPage, currentPage, scaleIdx, ayahs.length]);

  function changeMode(next: "page" | "flow") {
    setMode(next);
    try {
      localStorage.setItem("mushafMode", next);
    } catch {
      /* ignore */
    }
  }

  function changeScale(delta: number) {
    const next = Math.min(SCALES.length - 1, Math.max(0, scaleIdx + delta));
    setScaleIdx(next);
    try {
      localStorage.setItem("mushafScaleIdx", String(next));
    } catch {
      /* ignore */
    }
  }

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

  // Surah title banner + basmala appear only on the page where the surah
  // starts. Al-Fatihah's basmala is its own ayah 1 (already in the page text)
  // and At-Tawbah (9) has no basmala.
  const startsHere = pageAyahs.some((ayah) => ayah.verseNumber === 1);
  const showBasmala = startsHere && surahNumber !== 1 && surahNumber !== 9;

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
    <div className="mx-auto w-full max-w-5xl px-1 py-4 md:px-8 md:py-6">

      {/* طريقة العرض - Reading mode */}
      <div className="mb-3 flex justify-center">
        <div
          className="flex rounded-full bg-white p-1 shadow-sm"
          role="group"
          aria-label="طريقة العرض / View mode"
        >
          <button
            onClick={() => changeMode("flow")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              mode === "flow" ? "bg-[#187762] text-white" : "text-gray-500"
            }`}
          >
            قراءة مريحة · Comfortable
          </button>
          <button
            onClick={() => changeMode("page")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              mode === "page" ? "bg-[#187762] text-white" : "text-gray-500"
            }`}
          >
            صفحة المصحف · Mushaf page
          </button>
        </div>
      </div>

      {/* معلومات الصفحة */}
      <div
        dir="rtl"
        className="mb-5 flex items-center justify-between text-sm text-gray-500"
      >
        <span>الجزء {juz}</span>

        {/* حجم الخط - Text size */}
        <div
          dir="ltr"
          className="flex items-center gap-1 rounded-full bg-white px-1 py-1 shadow-sm"
          role="group"
          aria-label="حجم الخط / Text size"
        >
          <button
            onClick={() => changeScale(-1)}
            disabled={scaleIdx === 0}
            aria-label="تصغير الخط / Smaller text"
            className="h-8 w-8 rounded-full text-sm font-bold text-[#187762] transition hover:bg-[#e8f3ee] disabled:opacity-30"
          >
            أ-
          </button>
          <span className="min-w-[3rem] text-center text-xs font-semibold text-gray-600">
            {Math.round(SCALES[scaleIdx] * 100)}%
          </span>
          <button
            onClick={() => changeScale(1)}
            disabled={scaleIdx === SCALES.length - 1}
            aria-label="تكبير الخط / Larger text"
            className="h-8 w-8 rounded-full text-base font-bold text-[#187762] transition hover:bg-[#e8f3ee] disabled:opacity-30"
          >
            أ+
          </button>
        </div>

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
          px-1
          py-6
          shadow-sm
          md:min-h-[800px]
          md:px-10
          md:py-14
        "
        style={{
          borderColor: "#c9a24b",
          borderStyle: "double",
          borderWidth: "4px",
          boxShadow: "inset 0 0 0 2px #fffdf7, inset 0 0 0 3px #187762aa",
        }}
      >
        {loadedPage !== currentPage ? (
          <div className="py-20 text-center text-gray-400">
            جاري تحميل خط المصحف...
          </div>
        ) : (
          <div className="overflow-x-auto">
          <div
            ref={containerRef}
            className="mx-auto text-center text-[#123d35]"
            style={{
              containerType: "inline-size",
              width: mode === "page" ? `${SCALES[scaleIdx] * 100}%` : "100%",
              maxWidth: mode === "page" ? `${SCALES[scaleIdx] * 56}rem` : "56rem",
            }}
          >

            {startsHere && (
              <div className="mb-6">
                {/* Quranic-script font for the basmala (marks the QCF page
                    font does not carry). Falls back to a system serif. */}
                <link
                  rel="stylesheet"
                  href="https://fonts.googleapis.com/css2?family=Amiri+Quran&display=swap"
                />
                {surahName && (
                  <div
                    className="mx-auto mb-5 max-w-xl rounded-2xl bg-[#e8f3ee] py-2 text-2xl font-bold text-[#123d35]"
                    style={{
                      border: "3px double #c9a24b",
                      fontFamily: "'Amiri Quran', 'Traditional Arabic', serif",
                    }}
                  >
                    <span className="mx-3 text-[#c9a24b]">❁</span>
                    سورة {surahName}
                    <span className="mx-3 text-[#c9a24b]">❁</span>
                  </div>
                )}
                {showBasmala && (
                  <div
                    className="text-4xl text-[#123d35] md:text-5xl"
                    style={{
                      fontFamily: "'Amiri Quran', 'Traditional Arabic', serif",
                      lineHeight: 2,
                    }}
                  >
                    {BASMALA}
                  </div>
                )}
              </div>
            )}

            {mode === "flow" ? (
              <div
                dir="rtl"
                className="flex flex-wrap items-center justify-center gap-x-[3px] gap-y-3 pb-4"
              >
                {words.map((word) => {
                  const isEnd = word.charTypeName === "end";
                  const base = `calc(${SCALES[scaleIdx]} * clamp(30px, 8.2vw, 50px))`;
                  return (
                    <span
                      key={word.id}
                      style={{
                        fontFamily: `p${currentPage}-v2`,
                        fontSize: isEnd ? `calc(${base} * 0.8)` : base,
                        lineHeight: 1.9,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: word.codeV2 || word.text || "",
                      }}
                    />
                  );
                })}
              </div>
            ) : lineNumbers.map((lineNumber) => {
              const lineWords = words.filter(
                (word) => word.lineNumber === lineNumber
              );

              return (
                <div
                  key={lineNumber}
                  data-line={lineNumber}
                  dir="rtl"
                  className={`flex items-center gap-[2px] whitespace-nowrap ${
                    fullLines.includes(lineNumber)
                      ? "justify-between"
                      : "justify-center"
                  }`}
                  style={{ minHeight: `${(fitPx ?? 28) * 1.75}px` }}
                >
                  {lineWords.map((word) => {
                    const isEnd = word.charTypeName === "end";

                    if (isEnd) {
                      // "text_qpc_hafs" isn't a real field in this API/SDK
                      // version - codeV2 already carries the correct QCF v2
                      // glyph for the ayah-end ornament, same as every other
                      // word on the page, so render it the same way instead
                      // of falling back to plain (garbled) Arabic text.
                      return (
                        <span
                          key={word.id}
                          style={{
                            fontFamily: `p${currentPage}-v2`,
                            fontSize: `${(fitPx ?? 28) * 0.68}px`,
                          }}
                          dangerouslySetInnerHTML={{
                            __html: word.codeV2 || word.text || "",
                          }}
                        />
                      );
                    }

                    return (
                      <span
                        key={word.id}
                        data-w="1"
                        style={{
                          fontFamily: `p${currentPage}-v2`,
                          fontSize: `${fitPx ?? 28}px`,
                          lineHeight: 1.7,
                        }}
                        dangerouslySetInnerHTML={{
                          __html: word.codeV2 || word.text || "",
                        }}
                      />
                    );
                  })}

                </div>
              );
            })}

          </div>
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