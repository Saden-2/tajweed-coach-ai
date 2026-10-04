"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lets the learner LISTEN to a professional reciter for the selected ayah
 * before recording their own recitation (the "model to imitate").
 *
 * Audio source: EveryAyah.com per-ayah MP3 files (free for non-commercial /
 * educational use; see SOURCES.md). The audio is streamed directly from the
 * source in the learner's browser - we do not copy or host it.
 */

const RECITERS = [
  { id: "Alafasy_128kbps", ar: "مشاري العفاسي", en: "Mishary Alafasy" },
  { id: "Husary_128kbps", ar: "محمود خليل الحصري", en: "Mahmoud Khalil Al-Husary" },
  {
    id: "Minshawy_Murattal_128kbps",
    ar: "محمد صديق المنشاوي",
    en: "Mohamed Siddiq Al-Minshawi",
  },
  {
    id: "Abdul_Basit_Murattal_192kbps",
    ar: "عبد الباسط عبد الصمد",
    en: "Abdul Basit Abdus-Samad",
  },
  {
    id: "Abdurrahmaan_As-Sudais_192kbps",
    ar: "عبد الرحمن السديس",
    en: "Abdurrahman As-Sudais",
  },
  { id: "Saood_ash-Shuraym_128kbps", ar: "سعود الشريم", en: "Saud Ash-Shuraim" },
  { id: "Ghamadi_40kbps", ar: "سعد الغامدي", en: "Saad Al-Ghamdi" },
  { id: "Hudhaify_128kbps", ar: "علي الحذيفي", en: "Ali Al-Hudhaifi" },
  { id: "Nasser_Alqatami_128kbps", ar: "ناصر القطامي", en: "Nasser Al-Qatami" },
  {
    id: "Yasser_Ad-Dussary_128kbps",
    ar: "ياسر الدوسري",
    en: "Yasser Ad-Dossari",
  },
  {
    id: "Abu_Bakr_Ash-Shaatree_128kbps",
    ar: "أبو بكر الشاطري",
    en: "Abu Bakr Ash-Shatri",
  },
];

export function ayahAudioUrl(reciter: string, surah: number, ayah: number) {
  const s = String(surah).padStart(3, "0");
  const a = String(ayah).padStart(3, "0");
  return `https://everyayah.com/data/${reciter}/${s}${a}.mp3`;
}

type Props = {
  surah: number;
  ayah: number;
  isArabic: boolean;
  /** Called when an ayah finishes while "continuous play" is on. */
  onNext?: () => void;
  /** True when there is a next ayah to advance to. */
  hasNext?: boolean;
};

export default function AyahPlayer({
  surah,
  ayah,
  isArabic,
  onNext,
  hasNext = false,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [reciter, setReciter] = useState(RECITERS[0].id);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [continuous, setContinuous] = useState(false);
  // Set when an ayah ended in continuous mode, so the next one starts itself.
  const autoplayNext = useRef(false);

  // Stop and reset whenever the ayah or the reciter changes.
  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlaying(false);
    setFailed(false);
    if (autoplayNext.current && el) {
      autoplayNext.current = false;
      el.play().catch(() => setFailed(true));
    }
  }, [surah, ayah, reciter]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    setFailed(false);
    el.play().catch(() => setFailed(true));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
      <button
        onClick={toggle}
        className="rounded-full bg-[#187762] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#145f4f]"
        aria-label={isArabic ? "استمع إلى الآية" : "Listen to the ayah"}
      >
        {playing
          ? isArabic
            ? "⏸ إيقاف"
            : "⏸ Pause"
          : isArabic
            ? "🔊 استمع إلى الشيخ"
            : "🔊 Listen to the reciter"}
      </button>

      <select
        value={reciter}
        onChange={(e) => setReciter(e.target.value)}
        className="rounded-full border border-[#e4e0d5] bg-white px-3 py-2 text-sm text-gray-700"
        aria-label={isArabic ? "اختر القارئ" : "Choose reciter"}
      >
        {RECITERS.map((r) => (
          <option key={r.id} value={r.id}>
            {isArabic ? r.ar : r.en}
          </option>
        ))}
      </select>

      {onNext && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={continuous}
            onChange={(e) => setContinuous(e.target.checked)}
            className="h-4 w-4 accent-[#187762]"
          />
          {isArabic ? "تشغيل متتابع" : "Play continuously"}
        </label>
      )}

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={ayahAudioUrl(reciter, surah, ayah)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          if (continuous && hasNext && onNext) {
            autoplayNext.current = true;
            onNext();
          }
        }}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />

      {failed && (
        <p className="w-full text-xs font-semibold text-red-600">
          {isArabic
            ? "تعذّر تشغيل الصوت الآن. تحقق من الاتصال أو جرّب قارئًا آخر."
            : "Could not play the audio right now. Check your connection or try another reciter."}
        </p>
      )}
    </div>
  );
}
