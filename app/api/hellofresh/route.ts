import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("files") as File[];

  if (!files?.length) {
    return NextResponse.json({ error: "No files" }, { status: 400 });
  }

  const dir = path.join(os.tmpdir(), "mise-hf");
  await mkdir(dir, { recursive: true });

  const imported: any[] = [];

  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const pdfPath = path.join(dir, `${Date.now()}-${f.name.replaceAll(" ", "_")}`);
    const jsonPath = pdfPath.replace(/\.pdf$/i, "") + ".json";

    await writeFile(pdfPath, buf);

    // ⚠️ Ajusta esta ruta al script real de tu repo:
    // por ejemplo: scripts/extract_hf_pdf.py
  await run("python", ["scripts/extract_hf_pdf.py", pdfPath, jsonPath]);


    const out = JSON.parse(await readFile(jsonPath, "utf-8"));

    // upsert
    const saved = await prisma.recipe.upsert({
      where: { id: out.id },
      update: {
        title: out.title,
        description: out.description,
        mealType: out.mealType,
        timeMin: out.timeMin,
        costTier: out.costTier,
        difficulty: out.difficulty,
        tags: out.tags,
        active: !!out.active,
        ingredients: out.ingredients,
        steps: out.steps,
      },
      create: {
        id: out.id,
        title: out.title,
        description: out.description,
        mealType: out.mealType,
        timeMin: out.timeMin,
        costTier: out.costTier,
        difficulty: out.difficulty,
        tags: out.tags,
        active: !!out.active,
        ingredients: out.ingredients,
        steps: out.steps,
      },
    });

    imported.push(saved);
  }

  return NextResponse.json({ count: imported.length, recipes: imported });
}
