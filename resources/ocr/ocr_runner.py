#!/usr/bin/env python3
import argparse
import json
import os
import sys
import tempfile
from typing import Any


def _runtime_root() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)

    return os.path.dirname(os.path.abspath(__file__))


def _configure_tesseract() -> None:
    try:
        import pytesseract  # type: ignore
    except Exception:
        return

    runtime_root = _runtime_root()
    bundled_tesseract = os.path.join(
        runtime_root,
        "tesseract",
        "tesseract.exe" if os.name == "nt" else "tesseract",
    )
    bundled_tessdata = os.path.join(runtime_root, "tesseract", "tessdata")

    if os.path.exists(bundled_tesseract):
        pytesseract.pytesseract.tesseract_cmd = bundled_tesseract

    if os.path.isdir(bundled_tessdata):
        os.environ.setdefault("TESSDATA_PREFIX", bundled_tessdata)


def get_status() -> dict[str, Any]:
    try:
        import fitz  # type: ignore
    except Exception as error:  # pragma: no cover - runtime-only dependency
        return {
            "available": False,
            "engine": None,
            "message": f"PyMuPDF is unavailable: {error}",
        }

    try:
        import pytesseract  # type: ignore
    except Exception as error:  # pragma: no cover - runtime-only dependency
        return {
            "available": False,
            "engine": None,
            "message": f"pytesseract is unavailable: {error}",
        }

    _configure_tesseract()

    try:
        pytesseract.get_tesseract_version()
    except Exception as error:  # pragma: no cover - runtime-only dependency
        return {
            "available": False,
            "engine": None,
            "message": f"Tesseract is unavailable: {error}",
        }

    return {
        "available": True,
        "engine": "PyMuPDF + pytesseract",
        "message": "OCR runtime ready for scanned typed PDFs.",
    }


def _average_confidence(data: dict[str, list[str]]) -> float | None:
    confidences: list[float] = []
    for raw_value in data.get("conf", []):
        try:
            value = float(raw_value)
        except Exception:
            continue

        if value >= 0:
            confidences.append(value)

    if not confidences:
        return None

    return sum(confidences) / len(confidences)


def run_ocr(payload: dict[str, Any]) -> dict[str, Any]:
    import fitz  # type: ignore
    import pytesseract  # type: ignore
    from pytesseract import Output  # type: ignore

    _configure_tesseract()

    pdf_path = payload.get("pdf_path")
    pages = payload.get("pages", [])
    temp_dir = payload.get("temp_dir")

    if not isinstance(pdf_path, str) or not pdf_path:
        raise ValueError("Missing pdf_path")

    if not isinstance(pages, list):
        raise ValueError("pages must be a list")

    if isinstance(temp_dir, str) and temp_dir:
        os.makedirs(temp_dir, exist_ok=True)
        temp_root = temp_dir
    else:
        temp_root = None

    document = fitz.open(pdf_path)
    results: list[dict[str, Any]] = []

    try:
        for page_request in pages:
            page_id = page_request.get("page_id")
            page_number = page_request.get("page_number")

            if not isinstance(page_id, str) or not isinstance(page_number, int):
                continue

            try:
                page = document.load_page(page_number - 1)
                matrix = fitz.Matrix(2.0, 2.0)
                pixmap = page.get_pixmap(matrix=matrix, alpha=False)

                with tempfile.NamedTemporaryFile(
                    suffix=".png",
                    delete=False,
                    dir=temp_root,
                ) as temp_file:
                    image_path = temp_file.name

                try:
                    pixmap.save(image_path)
                    text = pytesseract.image_to_string(
                        image_path,
                        config="--psm 6 -c preserve_interword_spaces=1",
                    )
                    data = pytesseract.image_to_data(
                        image_path,
                        config="--psm 6 -c preserve_interword_spaces=1",
                        output_type=Output.DICT,
                    )
                    results.append(
                        {
                            "page_id": page_id,
                            "text": text.strip(),
                            "confidence": _average_confidence(data),
                            "warning": None,
                        }
                    )
                finally:
                    try:
                        os.unlink(image_path)
                    except OSError:
                        pass
            except Exception as error:
                results.append(
                    {
                        "page_id": page_id,
                        "text": "",
                        "confidence": None,
                        "warning": str(error),
                    }
                )
    finally:
        document.close()

    return {
        "pages": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()

    if args.status:
        print(json.dumps(get_status()))
        return 0

    payload = json.load(sys.stdin)
    print(json.dumps(run_ocr(payload)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
