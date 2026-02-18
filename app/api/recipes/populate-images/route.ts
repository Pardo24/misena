import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildCandidateQueries,
  getRecipeDetail,
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

export async function POST(req: NextRequest) {
  if (!process.env.HFRESH_API_TOKEN) {
    return ndjson({ error: "HFRESH_API_TOKEN missing" }, true);
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  const recipes = await prisma.recipe.findMany({
    where: {
      OR: [
        { imageUrl: null },
        { imageUrl: { contains: "unsplash" } },
      ],
    },
    select: { id: true, title: true, source: true, sourceId: true },
    ...(limit ? { take: limit } : {}),
  });

  if (recipes.length === 0) {
    return ndjson({ ok: true, message: "All recipes already have images", updated: 0 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      let updated = 0;

      for (const r of recipes) {
        const title = r.title as Record<string, string>;
        const titleRaw = title.es || title.ca || Object.values(title)[0] || "";

        let scrapeUrl: string | null = null;

        // For hfresh-sourced recipes, get URL directly via API detail
        if (r.source === "hfresh" && r.sourceId) {
          try {
            const detail = await getRecipeDetail(Number(r.sourceId));
            scrapeUrl = detail.url || null;
          } catch {
            send({ id: r.id, title: titleRaw, status: "DETAIL_FETCH_FAILED" });
          }
        }

        // Fallback: fuzzy search for non-hfresh or if detail fetch failed
        if (!scrapeUrl) {
          const { url, query } = await findHelloFreshUrl(titleRaw);
          if (!url) {
            send({ id: r.id, title: titleRaw, status: "NO_HF_MATCH", query });
            continue;
          }
          scrapeUrl = url;
        }

        const page = await scrapeRecipePage(scrapeUrl);

        if (!page.ogImage) {
          send({ id: r.id, title: titleRaw, status: "NO_OG_IMAGE" });
          continue;
        }

        const stepImages = page.stepImages.length > 0 ? page.stepImages : undefined;

        await prisma.recipe.update({
          where: { id: r.id },
          data: {
            imageUrl: page.ogImage,
            ...(stepImages ? { stepImages } : {}),
          },
        });

        updated++;
        send({ id: r.id, title: titleRaw, status: "OK", imageUrl: page.ogImage });
        await sleep(800);
      }

      send({ done: true, total: recipes.length, updated });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}

function ndjson(obj: Record<string, unknown>, isError = false) {
  return new Response(JSON.stringify(obj) + "\n", {
    status: isError ? 500 : 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
