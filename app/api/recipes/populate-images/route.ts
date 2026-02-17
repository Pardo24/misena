import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildCandidateQueries,
  scrapeRecipePage,
  searchRecipes,
  scoreMatch,
} from "@/lib/hfresh";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findHelloFreshUrl(titleRaw: string): Promise<{ url: string | null; query: string }> {
  const queries = buildCandidateQueries(titleRaw);

  for (const q of queries) {
    try {
      const res = await searchRecipes(q, { perPage: 30 });
      const items = res.data;
      if (!items?.length) continue;

      let best = items[0];
      let bestScore = scoreMatch(q, items[0].name || "");

      for (const it of items.slice(1)) {
        const sc = scoreMatch(q, it.name || "");
        if (sc > bestScore) { best = it; bestScore = sc; }
      }

      if (bestScore > 0.45 && best.url) {
        return { url: best.url, query: q };
      }
    } catch { /* try next query */ }
  }

  return { url: null, query: queries[0] ?? "" };
}

export async function POST() {
  if (!process.env.HFRESH_API_TOKEN) {
    return NextResponse.json({ error: "HFRESH_API_TOKEN missing" }, { status: 500 });
  }

  const recipes = await prisma.recipe.findMany({
    where: {
      OR: [
        { imageUrl: null },
        { imageUrl: { contains: "unsplash" } },
      ],
    },
    select: { id: true, title: true, steps: true },
  });

  if (recipes.length === 0) {
    return NextResponse.json({ ok: true, message: "All recipes already have images", updated: 0 });
  }

  let updated = 0;
  const failed: Array<{ id: string; reason: string; query?: string }> = [];

  for (const r of recipes) {
    const title = r.title as Record<string, string>;
    const titleRaw = title.es || title.ca || Object.values(title)[0] || "";

    const { url: hfUrl, query } = await findHelloFreshUrl(titleRaw);

    if (!hfUrl) {
      failed.push({ id: r.id, reason: "NO_HF_MATCH", query });
      continue;
    }

    const page = await scrapeRecipePage(hfUrl);

    if (!page.ogImage) {
      failed.push({ id: r.id, reason: "NO_OG_IMAGE", query });
      continue;
    }

    // Save step images as a parallel array (not injected into steps)
    const stepImages = page.stepImages.length > 0 ? page.stepImages : undefined;

    await prisma.recipe.update({
      where: { id: r.id },
      data: {
        imageUrl: page.ogImage,
        ...(stepImages ? { stepImages } : {}),
      },
    });

    updated++;
    await sleep(800);
  }

  return NextResponse.json({ ok: true, total: recipes.length, updated, failed });
}
