export default function Credits() {
  return (
    <footer className="px-4 py-3 text-center text-[11px] leading-5 text-gray-500">
      Quran text, page fonts and English translation (Saheeh International):{" "}
      <a
        href="https://quran.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Quran.com / Quran Foundation
      </a>{" "}
      · Reciter audio:{" "}
      <a
        href="https://everyayah.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        EveryAyah
      </a>{" "}
      · AI model: quran-muaalem ·{" "}
      <a
        href="https://github.com/Saden-2/tajweed-coach-ai/blob/master/SOURCES.md"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        All sources
      </a>
    </footer>
  );
}
