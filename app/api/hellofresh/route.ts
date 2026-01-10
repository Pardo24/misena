import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs"; // necesario (fs + child_process)

const execFileAsync = promisify(execFile);

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("pdf");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta el campo 'pdf' (File)" }, { status: 400 });
    }

  const name = (file as any).name?.toLowerCase?.() ?? "";
  const looksPdf = file.type === "application/pdf" || name.endsWith(".pdf");

  if (!looksPdf) {
    return NextResponse.json({ error: "El archivo no es PDF" }, { status: 400 });
  }

    const tmpDir = path.join(os.tmpdir(), `mise_${randomUUID()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    const pdfPath = path.join(tmpDir, "input.pdf");
    const outPath = path.join(tmpDir, "recipe.json");

    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(pdfPath, buf);

    // En Windows a veces es "python" o "py"
    const pythonCmd = process.platform === "win32" ? "py" : "python3";

    await execFileAsync(pythonCmd, [
      path.join(process.cwd(), "scripts", "extract_hf_pdf.py"),
      pdfPath,
      outPath,
    ]);

    const jsonText = await fs.readFile(outPath, "utf-8");


    function ensureEsCa<T extends { es?: string; ca?: string }>(obj: T): T {
  if (!obj) return obj;
  if (!obj.es) obj.es = "";
  if (!obj.ca) obj.ca = obj.es;
  return obj;
}

function normalizeRecipeLangs(recipe: any) {
  recipe.title = ensureEsCa(recipe.title ?? { es: "", ca: "" });
  recipe.description = ensureEsCa(recipe.description ?? { es: "", ca: "" });

  // steps: si viene como {es:[], ca:[]} o similar
  if (!recipe.steps) recipe.steps = { es: [], ca: [] };
  if (!Array.isArray(recipe.steps.es)) recipe.steps.es = [];
  if (!Array.isArray(recipe.steps.ca) || recipe.steps.ca.length === 0) {
    recipe.steps.ca = [...recipe.steps.es];
  }

  // ingredientes: name {es,ca}
  if (!Array.isArray(recipe.ingredients)) recipe.ingredients = [];
  recipe.ingredients = recipe.ingredients.map((ing: any) => {
    // si name llega como string, lo convertimos
    const nameObj =
      typeof ing.name === "string"
        ? { es: ing.name, ca: ing.name }
        : ensureEsCa(ing.name ?? { es: "", ca: "" });

    // si falta qty2/qty4 textos, déjalos como undefined
    return { ...ing, name: nameObj };
  });

  return recipe;
}

  let recipe = JSON.parse(jsonText);
  recipe = normalizeRecipeLangs(recipe);

    // Limpieza best-effort
    await fs.rm(tmpDir, { recursive: true, force: true });

    return NextResponse.json({ recipe });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Error importando PDF", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
