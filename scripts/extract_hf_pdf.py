import json
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def page_text_with_bold(page: fitz.Page) -> str:
    d = page.get_text("dict")
    out_lines = []

    for block in d.get("blocks", []):
        for line in block.get("lines", []):
            parts = []
            for span in line.get("spans", []):
                txt = span.get("text", "")
                if not txt.strip():
                    continue
                font = (span.get("font") or "").lower()
                is_bold = "bold" in font or "black" in font or "semibold" in font
                if is_bold:
                    parts.append(f"**{txt}**")
                else:
                    parts.append(txt)
            if parts:
                out_lines.append(" ".join(parts))
    return "\n".join(out_lines)


def get_text_blocks(page: fitz.Page):
    """Devuelve bloques de texto con bbox y texto plano."""
    d = page.get_text("dict")
    out = []
    for b in d.get("blocks", []):
        if b.get("type") != 0:
            continue
        bbox = b.get("bbox")
        parts = []
        for line in b.get("lines", []):
            for span in line.get("spans", []):
                t = span.get("text", "")
                if t and t.strip():
                    parts.append(t)
        text = norm(" ".join(parts))
        if text:
            out.append({"bbox": bbox, "text": text})
    return out


def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_") or "recipe"


def pick_title(doc: fitz.Document) -> str:
    """Heurística: el texto más grande en la página 1 suele ser el título."""
    page = doc[0]
    d = page.get_text("dict")
    best_text = ""
    best_size = 0.0
    for b in d.get("blocks", []):
        if b.get("type") != 0:
            continue
        for line in b.get("lines", []):
            for span in line.get("spans", []):
                txt = norm(span.get("text", ""))
                size = float(span.get("size", 0))
                if len(txt) >= 6 and size > best_size:
                    best_size = size
                    best_text = txt
    return best_text or "Recipe"


def extract_time_minutes(doc: fitz.Document) -> int:
    txt = "\n".join([doc[i].get_text("text") for i in range(len(doc))]).lower()
    # suele haber "TOTAL: 30 MIN"
    m = re.search(r"total[:\s]+(\d{1,3})\s*min", txt)
    if m:
        return int(m.group(1))
    # fallback: primer "xx min"
    m2 = re.search(r"(\d{1,3})\s*min", txt)
    return int(m2.group(1)) if m2 else 0


def column_id(x0: float) -> int:
    # En los recipe cards típicos: 3 columnas de pasos
    if x0 < 380:
        return 1
    if x0 < 580:
        return 2
    return 3


def is_numbers_only(s: str) -> bool:
    # "1 2 3" / "4 5 6" / "12" etc.
    return re.fullmatch(r"\d+(?:\s+\d+)*", s.strip()) is not None


def is_heading(s: str) -> bool:
    s = s.strip()
    if not s:
        return False
    # encabezados cortos, sin puntuación final, típicamente 2–4 palabras
    if len(s) > 42:
        return False
    if any(ch in s for ch in [".", "!", "?", ":", ";"]):
        return False
    if "(" in s or ")" in s:
        return False
    words = s.split()
    if len(words) < 2 or len(words) > 6:
        return False
    # primera letra mayúscula
    return s[0].isupper()


def bullets_by_sentence(text: str) -> str:
    """
    Convierte un párrafo en:
    • frase 1
    • frase 2
    ...
    """
    t = norm(text)

    # separa recordatorios tipo "RECUERDA ..." como frase aparte
    t = re.sub(r"\bRECUERDA[:\s]*", "RECUERDA: ", t, flags=re.IGNORECASE)

    # corte por puntuación final + espacio
    parts = re.split(r"(?<=[\.\!\?])\s+", t)
    parts = [p.strip() for p in parts if p.strip()]

    # fallback si no hay puntuación
    if len(parts) <= 1:
        return f"• {t}"

    out = []
    for p in parts:
        up = p.strip().upper()
        if up.startswith("CONSEJO") or up.startswith("TIP") or up.startswith("NOTA"):
            out.append(p.strip())          # sin "•"
        else:
            out.append(f"• {p.strip()}")
    return "\n".join(out)

def is_numbers_only_line(s: str) -> bool:
    return re.fullmatch(r"\d+(?:\s+\d+)*", s.strip()) is not None


def looks_like_step_title(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    low = s.lower()

    # descarta headers/secciones
    banned = {
        "antes de empezar", "utensilios necesarios:", "utensilios necesarios",
        "ingredientes", "información nutricional", "alérgenos"
    }
    if low in banned:
        return False

    # descarta "Paso 1" etc si aparece
    if re.fullmatch(r"paso\s+\d+", low):
        return False

    # descarta líneas solo números
    if is_numbers_only_line(s):
        return False

    # títulos: cortos, sin puntuación final típica
    if len(s) > 45:
        return False
    if any(ch in s for ch in [":", ".", "!", "?"]):
        return False

    # 2-6 palabras suele ser perfecto para HF
    words = s.split()
    if len(words) < 2 or len(words) > 7:
        return False

    # empieza por mayúscula
    return s[0].isupper()


def bullets_by_sentence(text: str) -> str:
    t = norm(text)
    t = re.sub(r"\bRECUERDA\b[:\s]*", "RECUERDA: ", t, flags=re.IGNORECASE)
    t = t.replace("  ", " ")

    # separa por . ! ? (y también por saltos que ya trae el PDF)
    parts = re.split(r"(?<=[\.\!\?])\s+|\n+", t)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) <= 1:
        return f"• {t}"

    return "\n".join([f"• {p}" for p in parts])


def extract_steps_as_blocks(doc: fitz.Document) -> list[str]:
    full = "\n".join(page_text_with_bold(doc[i]) for i in range(len(doc)))

    # recorta desde el primer paso hasta el final
    # si existe "¡Que aproveche!" lo usamos como final
    start_candidates = ["Prepara los ingredientes", "Preparar los ingredientes"]
    start_idx = -1
    for c in start_candidates:
        start_idx = full.lower().find(c.lower())
        if start_idx >= 0:
            break
    if start_idx < 0:
        # fallback: busca primera línea que parezca título después de "Alérgenos"
        i_all = full.lower().find("alérgenos")
        start_idx = i_all if i_all >= 0 else 0

    end_idx = full.lower().find("¡que aproveche")
    if end_idx < 0:
        end_idx = len(full)

    chunk = full[start_idx:end_idx]
    lines = [l.rstrip() for l in chunk.splitlines()]
    lines = [norm(l) for l in lines if norm(l)]

    steps = []
    current_title = None
    current_body = []

    def flush():
        nonlocal current_title, current_body
        if current_title and current_body:
            body = " ".join(current_body).strip()
            steps.append(current_title + "\n" + bullets_by_sentence(body))
        current_title = None
        current_body = []

    for line in lines:
        if looks_like_step_title(line):
            flush()
            current_title = line
            continue

        # ignora basura
        if is_numbers_only_line(line):
            continue
        if line.lower().startswith("paso "):
            continue
        if line.lower() in ("ingredientes", "pasos"):
            continue

        if current_title is not None:
            current_body.append(line)

    flush()

    return steps

def parse_amount_unit(qty_text: str):
    """
    Convierte '140 gramos' -> (140, 'g')
             '600 ml'     -> (600, 'ml')
             '1 unidad'   -> (1, 'u')
             '½ unidad'   -> (0.5, 'u')
             '2 sobres'   -> (2, 'u')  # lo tratamos como unidades
             '2 cucharaditas' -> (2, 'cdta')
    Si no puede, devuelve (None, None)
    """
    t = qty_text.strip().lower()
    t = t.replace(",", ".")
    # fracción ½
    t = t.replace("½", "0.5")

    m = re.match(r"^(\d+(?:\.\d+)?)\s+([a-záéíóúñ]+)", t)
    if not m:
        return None, None

    qty = float(m.group(1))
    unit = m.group(2)

    unit_map = {
        "gramo": "g", "gramos": "g",
        "ml": "ml",
        "unidad": "u", "unidades": "u",
        "sobre": "u", "sobres": "u",
        "cucharadita": "cdta", "cucharaditas": "cdta",
    }

    return qty, unit_map.get(unit, unit)


import re
import fitz  # pymupdf


def extract_ingredients(doc: fitz.Document) -> list[dict]:
    if len(doc) == 0:
        return []

    # 0) Encuentra la página donde está la tabla (Ingredientes + 2P/4P)
    ing_page_idx = None
    for i in range(len(doc)):
        t = (doc[i].get_text("text") or "").lower()
        if "ingredientes" in t and "2p" in t and "4p" in t:
            ing_page_idx = i
            break

    if ing_page_idx is None:
        # fallback: si no encuentra, intenta la 2ª página
        ing_page_idx = 1 if len(doc) > 1 else 0

    page = doc[ing_page_idx]
    W = float(page.rect.width)

    # Panel izquierdo: en tus PDFs suele ser ~30% de ancho
    LEFT_MAX_X = W * 0.36   # si te falla, prueba 0.34 / 0.40

    d = page.get_text("dict")

    # Borde derecho real de la tabla: usa el header "4P" si existe
    tableRightX = W * 0.36  # fallback razonable

    for block in d.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                txt = (span.get("text") or "").strip().lower()
                if txt == "4p":
                    # right edge del span "4P" + margen para incluir la columna 4P
                    tableRightX = span["bbox"][2] + 30
                    break

    # 1) Extrae líneas del panel izquierdo con bbox y texto
    left_lines = []
    for block in d.get("blocks", []):
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue

            x0 = min(s["bbox"][0] for s in spans)
            y0 = min(s["bbox"][1] for s in spans)
            x1 = max(s["bbox"][2] for s in spans)
            y1 = max(s["bbox"][3] for s in spans)

            if x1 > tableRightX:
                continue

            text = "".join(s.get("text", "") for s in spans).strip()
            text = re.sub(r"\s+", " ", text).strip()
            if not text:
                continue

            left_lines.append({"text": text, "bbox": (x0, y0, x1, y1), "xc": (x0 + x1) / 2.0})


    if not left_lines:
        return []

    left_lines.sort(key=lambda r: (r["bbox"][1], r["bbox"][0]))

    # 2) Encuentra rango vertical de la tabla: desde "Ingredientes" hasta "Información nutricional"/"Alérgenos"
    start_y = None
    end_y = None

    for r in left_lines:
        if r["text"].strip().lower() == "ingredientes":
            start_y = r["bbox"][3]
            break

    if start_y is None:
        return []

    for r in left_lines:
        low = r["text"].strip().lower()
        if r["bbox"][1] <= start_y:
            continue
        if low.startswith("información nutricional") or low.startswith("alérgenos") or low.startswith("*conservar"):
            end_y = r["bbox"][1]
            break

    if end_y is None:
        end_y = start_y + 9999

    table_lines = [
        r for r in left_lines
        if r["bbox"][1] > start_y and r["bbox"][1] < end_y
    ]

    # quita header
    table_lines = [r for r in table_lines if r["text"].strip().lower() not in ("2p 4p", "2p", "4p")]

    if not table_lines:
        return []

    # 3) Agrupa en filas por Y
    def cluster_rows_by_y(items, tol=3.0):
        rows = []
        for it in items:
            y = it["bbox"][1]
            placed = False
            for row in rows:
                if abs(row["y"] - y) <= tol:
                    row["items"].append(it)
                    row["y"] = (row["y"] + y) / 2.0
                    placed = True
                    break
            if not placed:
                rows.append({"y": y, "items": [it]})
        rows.sort(key=lambda r: r["y"])
        for row in rows:
            row["items"].sort(key=lambda r: r["bbox"][0])
        return rows

    rows = cluster_rows_by_y(table_lines, tol=3.0)

    # 4) Cortes de columnas: usa posiciones REALES de "2P" y "4P" (header)
    x_2p = None
    x_4p = None

    for r in left_lines:
        t = r["text"].strip().lower()
        if t == "2p":
            x_2p = r["xc"]
        elif t == "4p":
            x_4p = r["xc"]

    if x_2p is None or x_4p is None:
        # fallback por si el header no se extrajo como "2P" y "4P"
        # (ajusta si hace falta)
        cut1 = W * 0.20
        cut2 = W * 0.28
    else:
        # Nombre | 2P | 4P
        cut1 = x_2p - 15              # 15px a la izquierda del centro de 2P
        cut2 = (x_2p + x_4p) / 2.0    # frontera entre 2P y 4P


    ingredients = []

    # 5) Construye ingredientes por fila
    for row in rows:
        name_parts, q2_parts, q4_parts = [], [], []

        for it in row["items"]:
            x = it["xc"]
            txt = it["text"].strip()

            low = txt.lower()
            if low.startswith("antes de empezar") or low.startswith("utensilios"):
                continue

            if x < cut1:
                name_parts.append(txt)
            elif x < cut2:
                q2_parts.append(txt)
            else:
                q4_parts.append(txt)

        name = " ".join(name_parts).strip()
        qty2 = " ".join(q2_parts).strip()
        qty4 = " ".join(q4_parts).strip()

        name = name.replace("*", " ")
        name = re.sub(r"\s*\d+\)\s*", " ", name)  # quita 7) 13) etc
        name = re.sub(r"\s{2,}", " ", name).strip()

        if not name:
            continue
        if not qty2 and not qty4:
            continue

        ingredients.append({
            "name": {"es": name, "ca": name},
            "qty2Text": qty2,
            "qty4Text": qty4,
            "category": "unknown",
        })

    return ingredients


def derive_tags(time_min: int, ingredients: list[dict]) -> list[str]:
    tags = ["dinner"]
    if time_min and time_min <= 25:
        tags.append("quick")
    elif time_min and time_min <= 35:
        tags.append("normal")

    names = " ".join([(i["name"]["es"] or "").lower() for i in ingredients])
    if "chicken" in names:
        tags.append("chicken")
    if "pasta" in names or "orzo" in names:
        tags.append("pasta")
    if "zucchini" in names:
        tags.append("veg")

    # “budget” por defecto (tú luego lo puedes ajustar en la UI)
    tags.append("budget")
    return sorted(list(set(tags)))


def main():
    if len(sys.argv) < 3:
        print("Usage: python extract_hf_pdf.py <input.pdf> <output.json>", file=sys.stderr)
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    out_json = Path(sys.argv[2])

    doc = fitz.open(pdf_path)

    title = pick_title(doc)
    time_min = extract_time_minutes(doc)
    steps = extract_steps_as_blocks(doc)
    ingredients = extract_ingredients(doc)
    tags = derive_tags(time_min, ingredients)

    recipe = {
        "id": slugify(title),
        "title": {"es": title, "ca": title},
        "description": {"es": "", "ca": ""},
        "mealType": "dinner",
        "timeMin": time_min,
        "costTier": 2,
        "difficulty": "easy",
        "tags": tags,
        "active": 1,
        "ingredients": ingredients,
        "steps": {"es": steps, "ca": steps},
    }

    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(recipe, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(out_json))


if __name__ == "__main__":
    main()
