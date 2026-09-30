import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@quranjs/api/server";

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

    const verses = await client.content.v4.verses.byChapter(surah, {
      words: true,
      wordFields: ["code_v2", "text_qpc_hafs"],
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