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



def is_numbers_only_line(s: str) -> bool:
    return re.fullmatch(r"\d+(?:\s+\d+)*", s.strip()) is not None


def bullets_by_sentence(text: str) -> str:
    # mantiene sentido, y marca CONSEJO/RECUERDA/SABIAS QUE como cursiva sin bullet
    t = text.strip()
    t = re.sub(r"\s+", " ", t)

    parts = re.split(r"(?<=[\.\!\?])\s+", t)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) <= 1:
        p = t.strip()
        if p.upper().startswith(("CONSEJO:", "RECUERDA:", "SABIAS QUE:", "TIP:", "NOTA:")):
            return f"_{p}_"
        return f"• {p}"

    out = []
    for p in parts:
        p = p.strip()
        if p.startswith("•"):
            p = p.lstrip("•").strip()

        up = p.upper()
        if up.startswith(("CONSEJO:", "RECUERDA:","SABIAS QUE:", "TIP:", "NOTA:")):
            out.append(f"_{p}_")
        else:
            out.append(f"• {p}")
    return "\n".join(out)


def _span_is_bold(span) -> bool:
    font = (span.get("font") or "").lower()
    flags = int(span.get("flags") or 0)
    # flags 16 suele indicar bold en PyMuPDF, pero depende; combinamos con nombre de fuente.
    return ("bold" in font) or ("black" in font) or ("semibold" in font) or (flags & 16) != 0

def _line_bbox(line) -> tuple[float,float,float,float]:
    spans = line.get("spans", [])
    x0 = min(s["bbox"][0] for s in spans)
    y0 = min(s["bbox"][1] for s in spans)
    x1 = max(s["bbox"][2] for s in spans)
    y1 = max(s["bbox"][3] for s in spans)
    return (x0,y0,x1,y1)

def _line_text_with_bold(line) -> str:
    parts = []
    for span in line.get("spans", []):
        txt = span.get("text", "")
        if not txt or not txt.strip():
            continue
        txt = re.sub(r"\s+", " ", txt)
        if _span_is_bold(span):
            parts.append(f"**{txt}**")
        else:
            parts.append(txt)
    return re.sub(r"\s+", " ", " ".join(parts)).strip()

def _line_avg_size(line) -> float:
    spans = line.get("spans", [])
    if not spans:
        return 0.0
    return sum(float(s.get("size") or 0) for s in spans) / max(1, len(spans))

def _line_bold_ratio(line) -> float:
    spans = line.get("spans", [])
    if not spans:
        return 0.0
    b = sum(1 for s in spans if _span_is_bold(s))
    return b / len(spans)

def _is_numbers_only(s: str) -> bool:
    return bool(re.fullmatch(r"[\d\s]+", s.strip()))

def _clean_title(s: str) -> str:
    s = s.strip()
    # quita **...**
    if s.startswith("**") and s.endswith("**") and len(s) >= 4:
        s = s[2:-2].strip()
    return s

import re
import fitz  # PyMuPDF

def _span_is_bold(span) -> bool:
    font = (span.get("font") or "").lower()
    flags = int(span.get("flags") or 0)
    return ("bold" in font) or ("black" in font) or ("semibold" in font) or (flags & 16) != 0

def _rgb_from_int(c: int):
    # PyMuPDF suele dar 0xRRGGBB
    r = (c >> 16) & 255
    g = (c >> 8) & 255
    b = c & 255
    return r, g, b

def _is_greenish(color_int: int) -> bool:
    r, g, b = _rgb_from_int(int(color_int or 0))
    return g > 120 and g > r + 30 and g > b + 30

def _line_bbox(line) -> tuple[float,float,float,float]:
    spans = line.get("spans", [])
    x0 = min(s["bbox"][0] for s in spans)
    y0 = min(s["bbox"][1] for s in spans)
    x1 = max(s["bbox"][2] for s in spans)
    y1 = max(s["bbox"][3] for s in spans)
    return (x0,y0,x1,y1)

def _line_text_with_marks(line) -> str:
    parts = []
    for sp in line.get("spans", []):
        txt = sp.get("text", "")
        if not txt or not txt.strip():
            continue
        txt = re.sub(r"\s+", " ", txt)
        if _span_is_bold(sp):
            parts.append(f"**{txt}**")
        else:
            parts.append(txt)
    return re.sub(r"\s+", " ", " ".join(parts)).strip()

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def _cluster(values, tol):
    """cluster simple 1D. Devuelve lista de clusters (centro)."""
    values = sorted(values)
    clusters = []
    for v in values:
        placed = False
        for c in clusters:
            if abs(c["center"] - v) <= tol:
                c["vals"].append(v)
                c["center"] = sum(c["vals"]) / len(c["vals"])
                placed = True
                break
        if not placed:
            clusters.append({"center": v, "vals": [v]})
    return [c["center"] for c in sorted(clusters, key=lambda x: x["center"])]

def _find_best_steps_page(doc: fitz.Document):
    """elige la página con más números 1..6 en el área derecha (pasos)."""
    best = (None, 0, None)  # (idx, score, numbers)
    for i in range(len(doc)):
        page = doc[i]
        W = float(page.rect.width)
        d = page.get_text("dict")
        nums = []
        for b in d.get("blocks", []):
            for ln in b.get("lines", []):
                for sp in ln.get("spans", []):
                    t = _norm(sp.get("text", ""))
                    if t in ("1","2","3","4","5","6"):
                        x0,y0,x1,y1 = sp["bbox"]
                        # descarta sidebar izquierda
                        if x1 < W * 0.40:
                            continue
                        nums.append({"n": int(t), "bbox": sp["bbox"], "xc": (x0+x1)/2, "yc": (y0+y1)/2})
        uniq = sorted(set(n["n"] for n in nums))
        score = len(uniq)
        if score > best[1]:
            best = (i, score, nums)
    return best  # (page_idx, score, nums)

import re
import fitz  # PyMuPDF


def _span_is_bold(span) -> bool:
    font = (span.get("font") or "").lower()
    flags = int(span.get("flags") or 0)
    return ("bold" in font) or ("black" in font) or ("semibold" in font) or (flags & 16) != 0


def _line_bbox(line):
    spans = line.get("spans", [])
    x0 = min(s["bbox"][0] for s in spans)
    y0 = min(s["bbox"][1] for s in spans)
    x1 = max(s["bbox"][2] for s in spans)
    y1 = max(s["bbox"][3] for s in spans)
    return (x0, y0, x1, y1)


def _line_avg_size(line) -> float:
    spans = line.get("spans", [])
    if not spans:
        return 0.0
    return sum(float(s.get("size") or 0) for s in spans) / len(spans)


def _line_text_with_bold(line) -> str:
    parts = []
    for span in line.get("spans", []):
        txt = span.get("text", "")
        if not txt or not txt.strip():
            continue
        txt = re.sub(r"\s+", " ", txt)
        if _span_is_bold(span):
            parts.append(f"**{txt}**")
        else:
            parts.append(txt)
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def bullets_by_sentence(text: str) -> str:
    """
    - Convierte frases a bullets.
    - Si empieza por CONSEJO:/RECUERDA:/TIP:/NOTA: => en cursiva y SIN bullet (sin '•').
    """
    t = _norm(text.replace("\n", " "))
    t = re.sub(r"\b(RECUERDA|CONSEJO|TIP|NOTA)\b\s*[:：]\s*", r"\1: ", t, flags=re.IGNORECASE)

    parts = re.split(r"(?<=[\.\!\?])\s+", t)
    parts = [p.strip() for p in parts if p.strip()]

    out = []
    for p in parts:
        p = p.lstrip("•").strip()
        up = re.sub(r"\*\*", "", p).upper()
        if up.startswith(("CONSEJO:", "RECUERDA:", "TIP:", "NOTA:")):
            out.append(f"_{p}_")  # cursiva
        else:
            out.append(f"• {p}")
    return "\n".join(out)


def _detect_left_panel_right_edge(page: fitz.Page, fallback_ratio: float = 0.26) -> float:
    """
    Encuentra el borde derecho real del panel izquierdo usando el span '4P'.
    Devuelve X mínima para considerar que estamos en el panel de pasos.
    """
    W = float(page.rect.width)
    d = page.get_text("dict")
    best_x1 = None

    for b in d.get("blocks", []):
        if b.get("type") != 0:
            continue
        for line in b.get("lines", []):
            for span in line.get("spans", []):
                txt = (span.get("text") or "").strip().lower()
                if txt == "4p":
                    x1 = span["bbox"][2]
                    best_x1 = x1 if best_x1 is None else max(best_x1, x1)

    if best_x1 is None:
        best_x1 = W * fallback_ratio

    return best_x1 + 10  # margen


def extract_steps_as_blocks(doc: fitz.Document) -> list[str]:
    """
    ROBUSTO (4 o 6 pasos):
    - Se queda solo con el panel de pasos (a la derecha del panel de ingredientes).
    - Detecta títulos por tamaño de fuente.
    - Trocea por columnas (2 o 3) para evitar el intercalado.
    """
    best = None

    # 1) Encuentra la mejor página (normalmente la 2) por “¡Que aproveche!” + varios títulos
    for pi in range(len(doc)):
        page = doc[pi]
        x_min = _detect_left_panel_right_edge(page)
        d = page.get_text("dict")

        lines = []
        for b in d.get("blocks", []):
            if b.get("type") != 0:
                continue
            for line in b.get("lines", []):
                spans = line.get("spans", [])
                if not spans:
                    continue
                x0, y0, x1, y1 = _line_bbox(line)
                if x0 < x_min:
                    continue

                txt = _line_text_with_bold(line)
                if not txt:
                    continue

                lines.append({
                    "text": txt,
                    "bbox": (x0, y0, x1, y1),
                    "x0": x0,
                    "y0": y0,
                    "size": _line_avg_size(line),
                })

        if not lines:
            continue

        end_y = None
        for l in sorted(lines, key=lambda r: (r["y0"], r["x0"])):
            if "que aproveche" in re.sub(r"\*\*", "", l["text"]).lower():
                end_y = l["bbox"][1]
                break
        if end_y is None:
            continue

        sizes = sorted(l["size"] for l in lines if l["y0"] < end_y)
        if not sizes:
            continue

        med = sizes[len(sizes) // 2]
        title_thresh = med + 2.0  # suele separar 8.5 (cuerpo) vs 11-12 (título)

        def is_title(l) -> bool:
            if l["y0"] >= end_y:
                return False
            raw = re.sub(r"\*\*", "", l["text"]).strip()
            low = raw.lower()

            if re.fullmatch(r"\d+", raw):  # 1..6
                return False
            if "que aproveche" in low:
                return False
            if low.startswith(("consejo", "recuerda", "nota", "tip")):
                return False
            if l["size"] < title_thresh:
                return False
            if len(raw) > 70 or raw.endswith(".") or not raw[:1].isupper():
                return False

            w = len(raw.split())
            return 2 <= w <= 12

        titles = [l for l in lines if is_title(l)]
        score = len(titles)

        if score >= 2 and (best is None or score > best["score"]):
            best = {"pi": pi, "lines": lines, "end_y": end_y, "title_thresh": title_thresh, "score": score}

    if best is None:
        return []

    page = doc[best["pi"]]
    W = float(page.rect.width)
    end_y = best["end_y"]
    title_thresh = best["title_thresh"]

    lines = [l for l in best["lines"] if l["y0"] < end_y]

    def is_title(l) -> bool:
        raw = re.sub(r"\*\*", "", l["text"]).strip()
        low = raw.lower()
        if re.fullmatch(r"\d+", raw):
            return False
        if "que aproveche" in low:
            return False
        if low.startswith(("consejo", "recuerda", "nota", "tip")):
            return False
        if l["size"] < title_thresh:
            return False
        if len(raw) > 70 or raw.endswith(".") or not raw[:1].isupper():
            return False
        w = len(raw.split())
        return 2 <= w <= 12

    titles = [l for l in lines if is_title(l)]
    if not titles:
        return []

    # 2) Detecta columnas (2 o 3) agrupando por X
    titles_sorted = sorted(titles, key=lambda l: l["x0"])
    clusters = []
    gap = W * 0.12

    for t in titles_sorted:
        placed = False
        for c in clusters:
            if abs(c["x_mean"] - t["x0"]) <= gap / 2:
                c["items"].append(t)
                c["x_mean"] = (c["x_mean"] + t["x0"]) / 2
                placed = True
                break
        if not placed:
            clusters.append({"x_mean": t["x0"], "items": [t]})

    clusters.sort(key=lambda c: c["x_mean"])

    col_bounds = []
    for c in clusters:
        x_min = min(it["bbox"][0] for it in c["items"])
        x_max = max(it["bbox"][2] for it in c["items"])
        col_bounds.append({"x_min": x_min, "x_max": x_max, "items": c["items"]})

    boundaries = [-1e9]
    for i in range(len(col_bounds) - 1):
        boundaries.append((col_bounds[i]["x_max"] + col_bounds[i + 1]["x_min"]) / 2)
    boundaries.append(1e9)

    def col_idx(l) -> int:
        xc = (l["bbox"][0] + l["bbox"][2]) / 2
        for i in range(1, len(boundaries)):
            if boundaries[i - 1] <= xc < boundaries[i]:
                return i - 1
        return len(boundaries) - 2

    for l in lines:
        l["col"] = col_idx(l)

    # 3) Construye pasos por columna (evita mezcla entre columnas)
    titles_by_col = {}
    for t in titles:
        titles_by_col.setdefault(t["col"], []).append(t)

    steps = []
    for col, ts in titles_by_col.items():
        ts.sort(key=lambda l: l["y0"])

        for k, t in enumerate(ts):
            y_start = t["bbox"][3] - 0.1
            y_end = ts[k + 1]["bbox"][1] - 0.1 if k + 1 < len(ts) else end_y

            body = [l for l in lines if l["col"] == col and l["bbox"][1] >= y_start and l["bbox"][1] < y_end]
            body.sort(key=lambda l: (l["y0"], l["x0"]))

            parts = []
            for l in body:
                raw = l["text"].strip()
                raw_no = re.sub(r"\*\*", "", raw).strip()
                if not raw_no:
                    continue
                if re.fullmatch(r"\d+", raw_no):  # 1..6
                    continue
                # evita repetir el título
                if abs(l["y0"] - t["y0"]) < 1 and raw_no == re.sub(r"\*\*", "", t["text"]).strip():
                    continue
                parts.append(raw)

            title_clean = re.sub(r"^\*\*|\*\*$", "", t["text"]).strip()
            steps.append({
                "x": t["x0"],
                "y": t["y0"],
                "text": title_clean + "\n" + bullets_by_sentence(" ".join(parts)),
            })

    # orden lectura: por filas (y), y dentro por columnas (x)
    steps.sort(key=lambda s: (s["y"], s["x"]))
    return [s["text"] for s in steps]


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




def _extract_left_lines(page: fitz.Page, x_max: float):
    d = page.get_text("dict")
    out = []
    for b in d.get("blocks", []):
        if b.get("type") != 0:
            continue
        for line in b.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue

            x0 = min(s["bbox"][0] for s in spans)
            y0 = min(s["bbox"][1] for s in spans)
            x1 = max(s["bbox"][2] for s in spans)
            y1 = max(s["bbox"][3] for s in spans)

            if x1 > x_max:
                continue

            txt = "".join(s.get("text", "") for s in spans)
            txt = re.sub(r"\s+", " ", txt).strip()
            if txt:
                out.append({"text": txt, "bbox": (x0, y0, x1, y1), "xc": (x0 + x1) / 2})
    out.sort(key=lambda r: (r["bbox"][1], r["bbox"][0]))
    return out


def _cluster_rows_by_y(items, tol=2.5):
    rows = []
    for it in items:
        y = it["bbox"][1]
        placed = False
        for row in rows:
            if abs(row["y"] - y) <= tol:
                row["items"].append(it)
                row["y"] = (row["y"] + y) / 2
                placed = True
                break
        if not placed:
            rows.append({"y": y, "items": [it]})
    rows.sort(key=lambda r: r["y"])
    for row in rows:
        row["items"].sort(key=lambda it: it["bbox"][0])
    return rows


def _detect_left_panel_right_edge(page: fitz.Page, fallback_ratio: float = 0.26) -> float:
    W = float(page.rect.width)
    d = page.get_text("dict")
    best_x1 = None
    for b in d.get("blocks", []):
        if b.get("type") != 0:
            continue
        for line in b.get("lines", []):
            for span in line.get("spans", []):
                txt = (span.get("text") or "").strip().lower()
                if txt == "4p":
                    x1 = span["bbox"][2]
                    best_x1 = x1 if best_x1 is None else max(best_x1, x1)
    if best_x1 is None:
        best_x1 = W * fallback_ratio
    return best_x1


def extract_ingredients(doc: fitz.Document) -> list[dict]:
    if len(doc) == 0:
        return []

    # página con Ingredientes + 2P/4P (normalmente la 2)
    ing_page_idx = None
    for i in range(len(doc)):
        tx = (doc[i].get_text("text") or "").lower()
        if "ingredientes" in tx and ("2p" in tx and "4p" in tx):
            ing_page_idx = i
            break
    if ing_page_idx is None:
        ing_page_idx = 1 if len(doc) > 1 else 0

    page = doc[ing_page_idx]
    W = float(page.rect.width)

    # límite panel izq
    table_right_x = _detect_left_panel_right_edge(page) + 40  # margen para coger bien la col 4P
    left = _extract_left_lines(page, x_max=table_right_x)

    # rango vertical de la tabla
    start_y = None
    end_y = None

    for r in left:
        if r["text"].strip().lower() == "ingredientes":
            start_y = r["bbox"][3]
            break
    if start_y is None:
        return []

    for r in left:
        if r["bbox"][1] <= start_y:
            continue
        low = r["text"].strip().lower()
        if low.startswith("*conservar") or low.startswith("información nutricional") or low.startswith("alérgenos"):
            end_y = r["bbox"][1]
            break
    if end_y is None:
        end_y = page.rect.height

    table_lines = [r for r in left if r["bbox"][1] > start_y and r["bbox"][1] < end_y]
    table_lines = [r for r in table_lines if r["text"].strip().lower() not in ("2p", "4p", "2p 4p")]

    rows = _cluster_rows_by_y(table_lines, tol=2.5)

    # cortes de columnas por la posición de 2P/4P
    x2p = x4p = None
    for r in left:
        t = r["text"].strip().lower()
        if t == "2p":
            x2p = r["xc"]
        elif t == "4p":
            x4p = r["xc"]

    if x2p is None or x4p is None:
        cut1 = W * 0.18
        cut2 = W * 0.26
    else:
        cut1 = x2p - 15
        cut2 = (x2p + x4p) / 2.0

    # clasifica filas y repara nombres partidos
    cls = []
    for r in rows:
        name_parts, q2_parts, q4_parts = [], [], []
        for it in r["items"]:
            x = it["xc"]
            txt = it["text"].strip()
            if x < cut1:
                name_parts.append(txt)
            elif x < cut2:
                q2_parts.append(txt)
            else:
                q4_parts.append(txt)
        cls.append({"y": r["y"], "name_parts": name_parts, "q2_parts": q2_parts, "q4_parts": q4_parts})

    ingredients = []
    pending_name = []
    i = 0
    JOIN_NAME_TOL = 18

    while i < len(cls):
        r = cls[i]
        has_qty = bool(r["q2_parts"] or r["q4_parts"])

        if not has_qty:
            if r["name_parts"]:
                pending_name += r["name_parts"]
            i += 1
            continue

        name_parts = []
        if pending_name:
            name_parts += pending_name
        if r["name_parts"]:
            name_parts += r["name_parts"]

        qty2 = " ".join(r["q2_parts"]).strip()
        qty4 = " ".join(r["q4_parts"]).strip()

        # si justo después viene el resto del nombre (wrap), lo añadimos
        j = i + 1
        while j < len(cls):
            r2 = cls[j]
            if r2["name_parts"] and not (r2["q2_parts"] or r2["q4_parts"]) and abs(r2["y"] - r["y"]) <= JOIN_NAME_TOL:
                name_parts += r2["name_parts"]
                j += 1
            else:
                break

        i = j
        pending_name = []

        name = " ".join(name_parts).strip()
        name = name.replace("*", " ")
        name = re.sub(r"\s*\d+\)\s*", " ", name)  # quita 11) 13)...
        name = re.sub(r"\s{2,}", " ", name).strip()

        if name and (qty2 or qty4):
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
