import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@quranjs/api/server";
import { isValidChapterId } from "@quranjs/api";

// The Quran Foundation *prelive* gateway only serves a few surahs (we saw
// 404 for e.g. 50, 77, 78, 100, 112, 114). For those we fall back to the public
// Quran.com v4 API (same foundation, no login needed), which returns the same
// data in snake_case; we convert it to the camelCase shape the SDK returns.
const camelize = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(camelize);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [
        k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()),
        camelize(val),
      ])
    );
  }
  return v;
};

async function fetchPublicVerses(surah: string) {
  const verses: unknown[] = [];
  let page = 1;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_chapter/${encodeURIComponent(
        surah
      )}?words=true&word_fields=code_v2,text_uthmani&mushaf=1&per_page=50&page=${page}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`public api ${res.status}`);
    const json = await res.json();
    verses.push(...(camelize(json.verses ?? []) as unknown[]));
    const next = json.pagination?.next_page;
    if (!next) break;
    page = next;
  }
  return verses;
}

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.QURAN_CLIENT_ID;
    const clientSecret = process.env.QURAN_CLIENT_SECRET;

    // Credentials are optional: without them (e.g. the public demo
    // deployment, which should not hold any secret) every request is served
    // from the public Quran.com API (see fetchPublicVerses above).
    const client =
      clientId && clientSecret
        ? createServerClient({
            clientId,
            clientSecret,
            services: {
              gatewayUrl: "https://apis-prelive.quran.foundation",
              oauth2BaseUrl: "https://prelive-oauth2.quran.foundation",
            },
          })
        : null;

    const surah = request.nextUrl.searchParams.get("surah");

    if (!surah) {
      if (!client) {
        return NextResponse.json(
          { error: "Chapter list needs Quran Foundation credentials." },
          { status: 501 }
        );
      }
      const chapters = await client.content.v4.chapters.list();
      return NextResponse.json(chapters);
    }

    if (!isValidChapterId(surah)) {
      return NextResponse.json(
        { error: `Invalid surah number: ${surah}` },
        { status: 400 }
      );
    }

    // NOTE: the @quranjs/api SDK expects wordFields as an OBJECT map
    // (Partial<Record<WordField, boolean>>), not an array of strings. The
    // previous array form (wordFields: ["code_v2", "text_qpc_hafs"]) was
    // silently serialized into garbage query params (word_fields=0,1), so
    // the API never actually returned codeV2 glyph codes - the mushaf page
    // fell back to plain Arabic text rendered with the QCF glyph-
    // substitution font, which produced disconnected/garbled letter shapes.
    // Also, "text_qpc_hafs" / "textQpcHafs" is not a valid WordField in
    // this SDK version at all - codeV2 is what both normal words and the
    // ayah-end ornament glyph should use.
    //
    // NOTE: the Quran Foundation API paginates verses/by_chapter with a
    // default per_page of 10 (max 50) - it does NOT return the whole
    // surah by default. That's harmless for Al-Fatiha (7 ayat, fits in
    // one default page) but silently truncates every longer surah (e.g.
    // Al-Baqarah's 286 ayat would come back as just its first 10). We
    // page through with perPage=50 until a page comes back short, then
    // concatenate everything before returning it.
    let allVerses: unknown[] = [];
    try {
      if (!client) throw new Error("no Quran Foundation credentials configured");
      const sdkVerses: Awaited<
        ReturnType<typeof client.content.v4.verses.byChapter>
      > = [];
      const PER_PAGE = 50;
      let page = 1;
      // Safety cap: no surah has more than 286 ayat, so 10 pages (500
      // verses) is far more than enough headroom and avoids any risk of
      // looping forever if the API ever stops short-paging as expected.
      for (let i = 0; i < 10; i++) {
        const batch = await client.content.v4.verses.byChapter(surah, {
          words: true,
          wordFields: { codeV2: true, textUthmani: true },
          mushaf: 1,
          page,
          perPage: PER_PAGE,
        });
        sdkVerses.push(...batch);
        if (batch.length < PER_PAGE) break;
        page += 1;
      }


      allVerses = sdkVerses;
    } catch (sdkError) {
      console.warn("Prelive API failed for surah", surah, "- using public Quran.com API:", String(sdkError));
      allVerses = await fetchPublicVerses(surah);
    }

    return NextResponse.json(allVerses);
  } catch (error) {
    console.error("Quran API error:", error);

    return NextResponse.json(
      { error: "Failed to load Quran data." },
      { status: 500 }
    );
  }
}