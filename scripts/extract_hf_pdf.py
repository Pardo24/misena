import json
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


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

    return "\n".join([f"• {p}" for p in parts])

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
    full = "\n".join(doc[i].get_text("text") for i in range(len(doc)))

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


def extract_ingredients(doc: fitz.Document) -> list[dict]:
    full = "\n".join(doc[i].get_text("text") for i in range(len(doc)))

    lines = [norm(l) for l in full.splitlines()]
    lines = [l for l in lines if l]

   # 1) Recorta sección Ingredientes por líneas (robusto)
    in_ing = False
    raw = []

    for l in lines:
        low = l.lower()

        if low == "ingredientes":
            in_ing = True
            continue

        if not in_ing:
            continue

        # salta header "2P 4P"
        if low in ("2p 4p", "2p", "4p"):
            continue

        # fin de tabla
        if low.startswith("información nutricional") or low.startswith("alérgenos") or low.startswith("utensilios"):
            break
        if low.startswith("*conservar"):
            break

        raw.append(l)

    ingredients = []

    # 2) Regex para capturar pares cantidad+unidad
    qty_re = re.compile(
        r"(?P<num>½|\d+(?:[.,]\d+)?)\s*(?P<unit>gramos?|ml|m|unidades?|unidad|sobres?|sobre|cucharaditas?|cucharadita)\b",
        re.IGNORECASE
    )

    # ✅ COSE líneas: acumulamos hasta detectar 2 cantidades (2P y 4P)
    rows = []
    buf = ""

    for l in raw:
        # empezamos buffer si la línea parece relevante
        if not buf:
            # empezamos solo si hay número/½ o la palabra unidad/sobre/cucharadita/ml/gramos
            if not (re.search(r"\d|½", l) or re.search(r"\b(unidad|unidades|sobre|sobres|cucharadita|cucharaditas|ml|gramo|gramos)\b", l.lower())):
                continue
            buf = l.strip()
        else:
            buf = (buf + " " + l).strip()

        test = buf.replace("*", "").replace("10)", "").strip()
        test = test.replace("1/2", "½")
        test = re.sub(r"\b1\s*/\s*2\b", "½", test)
        matches = list(qty_re.finditer(test))

        if len(matches) >= 2:
            rows.append(test)
            buf = ""

    def norm_unit(u: str) -> str:
        u = u.lower()
        if u == "m":  # cuando el PDF corta "ml"
            return "ml"
        mapping = {
            "gramo": "g", "gramos": "g",
            "ml": "ml",
            "unidad": "u", "unidades": "u",
            "sobre": "u", "sobres": "u",
            "cucharadita": "cdta", "cucharaditas": "cdta",
        }
        return mapping.get(u, u)

    def parse_num(n: str):
        n = n.replace(",", ".").strip()
        if n == "½":
            return 0.5
        try:
            return float(n)
        except:
            return None

    for row in rows:
        # limpia asteriscos y el "10)" del apio
        row_clean = row.replace("*", "").replace("10)", "").strip()
        row_clean = row_clean.replace("1/2", "½")
        row_clean = re.sub(r"\b1\s*/\s*2\b", "½", row_clean)
        matches = list(qty_re.finditer(row_clean))

        # Caso raro: si solo pilla 1 match (p.ej. "Chili verde unidad 1 unidad" en tu copia),
        # intentamos inferir un "½ unidad" para 2P si aparece la palabra 'unidad' antes del match.
        if len(matches) == 1:
            m = matches[0]
            prefix_text = row_clean[:m.start()]
            prefix_low = prefix_text.lower()
            if " unidad" in prefix_low:
                name = norm(prefix_text.replace("unidad", "").strip())
                # inventamos un match de ½ unidad antes
                fake_qty2 = ("½", "unidad")
                qty4 = (m.group("num"), m.group("unit"))
                # nombre es lo que queda antes de la palabra "unidad" suelta
                if name:
                    q2n = parse_num(fake_qty2[0])
                    q4n = parse_num(qty4[0])
                    ingredients.append({
                        "name": {"es": name, "ca": name},
                        "qty2Text": f"{fake_qty2[0]} {fake_qty2[1]}",
                        "qty4Text": f"{qty4[0]} {qty4[1]}",
                        "qty2": q2n, "unit2": norm_unit(fake_qty2[1]),
                        "qty4": q4n, "unit4": norm_unit(qty4[1]),
                        "category": "unknown",
                    })
                continue

        if len(matches) < 2:
            continue  # no es una fila válida

        # Normalmente son exactamente 2: (2P) y (4P)
        m2, m4 = matches[0], matches[1]

        qty2_text = row_clean[m2.start():m2.end()].strip()
        qty4_text = row_clean[m4.start():m4.end()].strip()

        name_prefix = row_clean[:m2.start()].strip()
        name_mid = row_clean[m2.end():m4.start()].strip()
        name_suffix = row_clean[m4.end():].strip()

        # El nombre puede estar antes, entre, o después de las cantidades
        name = " ".join([name_prefix, name_mid, name_suffix]).strip()

        ingredients.append({
            "name": {"es": name, "ca": name},
            "qty2Text": qty2_text,
            "qty4Text": qty4_text,
            "qty2": parse_num(m2.group("num")),
            "unit2": norm_unit(m2.group("unit")),
            "qty4": parse_num(m4.group("num")),
            "unit4": norm_unit(m4.group("unit")),
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
