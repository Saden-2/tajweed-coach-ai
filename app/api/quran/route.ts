import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@quranjs/api/server";
import { isValidChapterId } from "@quranjs/api";

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.QURAN_CLIENT_ID;
    const clientSecret = process.env.QURAN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Quran Foundation credentials are missing." },
        { status: 500 }
      );
    }

    const client = createServerClient({
      clientId,
      clientSecret,
      services: {
        gatewayUrl: "https://apis-prelive.quran.foundation",
        oauth2BaseUrl: "https://prelive-oauth2.quran.foundation",
      },
    });

    const surah = request.nextUrl.searchParams.get("surah");

    if (!surah) {
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
    const allVerses: Awaited<
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
        wordFields: { codeV2: true },
        mushaf: 1,
        page,
        perPage: PER_PAGE,
      });
      allVerses.push(...batch);
      if (batch.length < PER_PAGE) break;
      page += 1;
    }

    console.log(
      "DEBUG verses fetched:",
      allVerses.length,
      "first word object:",
      JSON.stringify(allVerses?.[0]?.words?.[0], null, 2)
    );
    return NextResponse.json(allVerses);
  } catch (error) {
    console.error("Quran API error:", error);

    return NextResponse.json(
      { error: "Failed to load Quran data." },
      { status: 500 }
    );
  }
}