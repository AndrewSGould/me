"""Create a trim-size business-card PDF from the generated QR manifest."""

from __future__ import annotations

import json
import hashlib
import re
from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "output" / "qr" / "print-manifest.json"
OUTPUT_DIR = ROOT / "output" / "pdf"

CARD_WIDTH = 88.9 * mm
CARD_HEIGHT = 50.8 * mm
QR_SIZE = 30 * mm
PERMANENT_CARD_URL_SHA256 = "b4ad5e3c8aa7a16a4cf1a13f88085d80c4cc398fdbefaee75fd75ef9547f3124"


def fit_text(text: str, font: str, starting_size: float, max_width: float) -> float:
    size = starting_size
    while size > 4 and stringWidth(text, font, size) > max_width:
        size -= 0.2
    return size


def draw_role(canvas: Canvas, role: dict[str, str], x: float, y: float, width: float) -> None:
    height = 9.5 * mm
    canvas.setFillColor(Color(1, 1, 1, alpha=0.055))
    canvas.setStrokeColor(Color(1, 1, 1, alpha=0.16))
    canvas.roundRect(x, y, width, height, 2.2 * mm, fill=1, stroke=1)

    mark_size = 7.2 * mm
    canvas.setFillColor(Color(0.34, 0.89, 0.78, alpha=0.14))
    canvas.roundRect(x + 1.3 * mm, y + 1.15 * mm, mark_size, mark_size, 1.8 * mm, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#9FF6DF"))
    canvas.setFont("Helvetica-Bold", fit_text(role["mark"], "Helvetica-Bold", 7.3, mark_size - 2 * mm))
    canvas.drawCentredString(x + 1.3 * mm + mark_size / 2, y + 3.75 * mm, role["mark"])

    text_x = x + 10.2 * mm
    text_width = width - 11.8 * mm
    canvas.setFillColor(HexColor("#F4F7FF"))
    canvas.setFont("Helvetica-Bold", fit_text(role["organization"], "Helvetica-Bold", 6.4, text_width))
    canvas.drawString(text_x, y + 5.65 * mm, role["organization"])
    canvas.setFillColor(HexColor("#AEB9D8"))
    title_size = fit_text(role["title"], "Helvetica", 5.2, text_width)
    canvas.setFont("Helvetica", title_size)
    canvas.drawString(text_x, y + 3.0 * mm, role["title"])


def draw_qr(canvas: Canvas, matrix: list[list[bool]], x: float, y: float) -> None:
    module = QR_SIZE / len(matrix)
    canvas.setFillColor(white)
    canvas.rect(x, y, QR_SIZE, QR_SIZE, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#000000"))
    for row, values in enumerate(matrix):
        for column, filled in enumerate(values):
            if filled:
                canvas.rect(
                    x + column * module,
                    y + (len(matrix) - row - 1) * module,
                    module,
                    module,
                    fill=1,
                    stroke=0,
                )


def svg_module_cells(svg: str) -> set[tuple[int, int]]:
    match = re.search(r'<path[^>]*\sd="([^"]+)"', svg)
    if not match:
        raise ValueError("Canonical QR SVG does not contain a path.")

    tokens = re.findall(r"[A-Za-z]|-?\d+(?:\.\d+)?", match.group(1))
    cells: set[tuple[int, int]] = set()
    x = y = 0.0
    start_x = start_y = 0.0
    index = 0
    while index < len(tokens):
        command = tokens[index]
        index += 1
        if command in {"M", "m"}:
            if index + 1 >= len(tokens):
                raise ValueError("Canonical QR SVG has a truncated move command.")
            next_x = float(tokens[index])
            next_y = float(tokens[index + 1])
            index += 2
            if command == "M":
                x, y = next_x, next_y
            else:
                x, y = x + next_x, y + next_y
            if not x.is_integer() or not y.is_integer():
                raise ValueError("Canonical QR SVG contains a fractional module.")
            start_x, start_y = x, y
            cells.add((int(x), int(y)))
        elif command in {"H", "h", "V", "v"}:
            if index >= len(tokens):
                raise ValueError("Canonical QR SVG has a truncated line command.")
            value = float(tokens[index])
            index += 1
            if command == "H":
                x = value
            elif command == "h":
                x += value
            elif command == "V":
                y = value
            else:
                y += value
        elif command in {"Z", "z"}:
            x, y = start_x, start_y
        else:
            raise ValueError("Canonical QR SVG contains an unsupported path command.")
    return cells


def validate_qr_artifacts(manifest: dict, matrix: list[list[bool]]) -> None:
    qr = manifest["qr"]
    expected_metadata = {
        "encoding": "byte",
        "version": 4,
        "errorCorrection": "H",
        "symbolModules": 33,
        "quietZoneModules": 4,
        "canvasModules": 41,
        "overallSizeMm": 30,
    }
    if any(qr.get(key) != value for key, value in expected_metadata.items()):
        raise ValueError("QR metadata does not match the permanent print specification.")

    payload = qr.get("payload", "")
    if len(payload.encode("utf-8")) != 34:
        raise ValueError("Permanent QR payload must be exactly 34 UTF-8 bytes.")
    if hashlib.sha256(payload.encode("utf-8")).hexdigest() != PERMANENT_CARD_URL_SHA256:
        raise ValueError("QR payload does not match the permanent card URL.")

    if len(matrix) != 41 or any(len(row) != 41 for row in matrix):
        raise ValueError("QR matrix must be 41 by 41 modules including its quiet zone.")
    if any(not isinstance(value, bool) for row in matrix for value in row):
        raise ValueError("QR matrix must contain only boolean modules.")
    for y, row in enumerate(matrix):
        for x, value in enumerate(row):
            if (x < 4 or y < 4 or x >= 37 or y >= 37) and value:
                raise ValueError("QR matrix does not have a clear four-module quiet zone.")

    serialized_matrix = json.dumps(matrix, separators=(",", ":")).encode("utf-8")
    if hashlib.sha256(serialized_matrix).hexdigest() != qr.get("matrixSha256"):
        raise ValueError("QR matrix digest does not match the generated manifest.")

    svg_file_name = manifest.get("svgFileName", "")
    if Path(svg_file_name).name != svg_file_name or not svg_file_name.endswith("-QR.svg"):
        raise ValueError("QR SVG filename is invalid.")
    svg_path = MANIFEST_PATH.parent / svg_file_name
    svg_bytes = svg_path.read_bytes()
    if hashlib.sha256(svg_bytes).hexdigest() != qr.get("svgSha256"):
        raise ValueError("Canonical QR SVG digest does not match the generated manifest.")
    svg = svg_bytes.decode("utf-8")
    if 'width="30mm" height="30mm" viewBox="0 0 41 41"' not in svg:
        raise ValueError("Canonical QR SVG dimensions do not match the print specification.")

    matrix_cells = {(x, y) for y, row in enumerate(matrix) for x, value in enumerate(row) if value}
    if svg_module_cells(svg) != matrix_cells:
        raise ValueError("Canonical QR SVG and print matrix do not contain the same modules.")


def create_pdf() -> Path:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    profile_name = manifest["fullName"]
    email = manifest["email"]
    roles = manifest["roles"]
    qr = manifest["qr"]
    matrix = manifest["matrix"]

    if len(roles) != 2:
        raise ValueError("Print manifest has an unexpected shape.")
    validate_qr_artifacts(manifest, matrix)

    file_slug = re.sub(r"[^A-Za-z0-9-]+", "-", profile_name).strip("-") or "card"
    output_path = OUTPUT_DIR / f"{file_slug}-Business-Card-Proof.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas = Canvas(str(output_path), pagesize=(CARD_WIDTH, CARD_HEIGHT), pageCompression=1)
    canvas.setTitle(f"{profile_name} business card print proof")
    canvas.setAuthor(profile_name)

    canvas.setFillColor(HexColor("#07102B"))
    canvas.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, fill=1, stroke=0)

    canvas.setFillColor(Color(0.11, 0.53, 0.82, alpha=0.18))
    canvas.circle(13 * mm, 47 * mm, 26 * mm, fill=1, stroke=0)
    canvas.setFillColor(Color(0.56, 0.21, 0.91, alpha=0.14))
    canvas.circle(72 * mm, 8 * mm, 27 * mm, fill=1, stroke=0)

    left_x = 5 * mm
    left_width = 45 * mm

    canvas.setFillColor(Color(0.43, 0.95, 0.83, alpha=0.15))
    canvas.roundRect(left_x, 40.3 * mm, 8 * mm, 7.2 * mm, 2 * mm, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#A5F3E0"))
    canvas.setFont("Helvetica-Bold", 12)
    canvas.drawCentredString(left_x + 4 * mm, 42.2 * mm, "AG")

    canvas.setFillColor(HexColor("#F7F9FF"))
    canvas.setFont("Helvetica-Bold", fit_text(profile_name, "Helvetica-Bold", 12.2, 34.5 * mm))
    canvas.drawString(15.2 * mm, 43.1 * mm, profile_name)
    canvas.setFillColor(HexColor("#7DE8D0"))
    canvas.setFont("Helvetica-Bold", 5.7)
    canvas.drawString(15.2 * mm, 40.5 * mm, "DISCORD-FIRST DIGITAL CARD")

    draw_role(canvas, roles[0], left_x, 28.1 * mm, left_width)
    draw_role(canvas, roles[1], left_x, 17.3 * mm, left_width)

    canvas.setFillColor(HexColor("#DCE4FA"))
    canvas.setFont("Helvetica-Bold", 6.2)
    canvas.drawString(left_x, 13.6 * mm, "Scan to connect")
    canvas.setFillColor(HexColor("#8F9BBB"))
    canvas.setFont("Helvetica", 5.1)
    canvas.drawString(left_x, 11.2 * mm, "Discord, contact file, email, and LinkedIn")

    qr_x = CARD_WIDTH - 5 * mm - QR_SIZE
    qr_y = 10.7 * mm
    draw_qr(canvas, matrix, qr_x, qr_y)
    canvas.setFillColor(HexColor("#A5F3E0"))
    canvas.setFont("Helvetica-Bold", 5.2)
    canvas.drawCentredString(qr_x + QR_SIZE / 2, 42.4 * mm, "SCAN - NO APP REQUIRED")

    canvas.setStrokeColor(Color(1, 1, 1, alpha=0.16))
    canvas.line(5 * mm, 8.2 * mm, CARD_WIDTH - 5 * mm, 8.2 * mm)

    card_url = qr["payload"]
    canvas.setFillColor(HexColor("#F4F7FF"))
    canvas.setFont("Helvetica-Bold", fit_text(card_url, "Helvetica-Bold", 5.2, CARD_WIDTH - 10 * mm))
    canvas.drawString(5 * mm, 5.35 * mm, card_url)
    canvas.setFillColor(HexColor("#AEB9D8"))
    canvas.setFont("Helvetica", fit_text(email, "Helvetica", 5.0, CARD_WIDTH - 10 * mm))
    canvas.drawString(5 * mm, 2.85 * mm, email)

    canvas.showPage()
    canvas.save()
    return output_path


if __name__ == "__main__":
    print(create_pdf())
