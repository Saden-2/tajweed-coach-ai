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
    const verses = await client.content.v4.verses.byChapter(surah, {
      words: true,
      wordFields: { codeV2: true },
      mushaf: 1,
    });

    console.log(
      "DEBUG first word object:",
      JSON.stringify(verses?.[0]?.words?.[0], null, 2)
    );
    return NextResponse.json(verses);
  } catch (error) {
    console.error("Quran API error:", error);

    return NextResponse.json(
      { error: "Failed to load Quran data." },
      { status: 500 }
    );
  }
}