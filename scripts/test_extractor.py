import re
import sys
import os
import requests
import PyPDF2
import fitz  # PyMuPDF for comparative analysis

sys.stdout.reconfigure(encoding="utf-8")

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
BASE_HOST = "https://www.indiacode.nic.in"

TARGET_ACTS = [
    {
        "name": "Code on Wages, 2019",
        "query": "Code on Wages 2019 Act No 29",
        "file_name": "Code_on_Wages_2019_Act_No_29.pdf",
    },
    {
        "name": "Bharatiya Nyaya Sanhita, 2023",
        "query": "Bharatiya Nyaya Sanhita 2023",
        "file_name": "Bharatiya_Nyaya_Sanhita_2023.pdf",
    },
    {
        "name": "Transfer of Property Act, 1882",
        "query": "Transfer of Property Act 1882",
        "file_name": "Transfer_of_Property_Act_1882.pdf",
    },
    {
        "name": "Indian Contract Act, 1872",
        "query": "Indian Contract Act 1872",
        "file_name": "Indian_Contract_Act_1872.pdf",
    },
    {
        "name": "Specific Relief Act, 1963",
        "query": "Specific Relief Act 1963",
        "file_name": "Specific_Relief_Act_1963.pdf",
    },
    {
        "name": "Indian Evidence Act, 1872",
        "query": "Indian Evidence Act 1872",
        "file_name": "Indian_Evidence_Act_1872.pdf",
    },
    {
        "name": "Code of Civil Procedure, 1908",
        "query": "Code of Civil Procedure 1908",
        "file_name": "Code_of_Civil_Procedure_1908.pdf",
    },
]


def extract_pdf_text_pypdf2(pdf_bytes: bytes) -> str:
    """Pure-Python PyPDF2 text extraction (Lambda safe, zero binary dependencies)."""
    import io
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        return text
    except Exception as exc:
        print(f"  PyPDF2 extraction error: {exc}")
        return ""


def extract_pdf_text_fitz(pdf_bytes: bytes) -> str:
    """PyMuPDF fitz text extraction (compiled C binary)."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    except Exception as exc:
        print(f"  fitz extraction error: {exc}")
        return ""


def extract_sections(full_text: str) -> list[dict[str, str]]:
    sections = []
    seen = set()

    pattern1 = re.compile(
        r"(?:^|\n)\s*(\d+[A-Z]?(?:\([0-9a-z]+\))?)\.\s*([A-Z][^\n\r]{2,120}?)(?:\.|\s*[\-–—]|\n)",
        re.MULTILINE,
    )
    pattern2 = re.compile(
        r"(?:^|\n)\s*(?:Section|Sec\.)\s*(\d+[A-Z]?(?:\([0-9a-z]+\))?)\.?\s*[\-–—:]?\s*([A-Z][^\n\r]{2,120}?)(?:\.|\s*[\-–—]|\n)",
        re.MULTILINE,
    )

    for p in [pattern1, pattern2]:
        for match in p.finditer(full_text):
            sec_num = match.group(1).strip()
            sec_title = match.group(2).strip()
            sec_title = re.sub(r"[\-–—.]+$", "", sec_title).strip()

            if (
                len(sec_title) < 3
                or sec_title.isdigit()
                or sec_num in seen
                or any(keyword in sec_title.upper() for keyword in ["ACT NO", "ARRANGEMENT OF SECTIONS", "MINISTRY OF", "CHAPTER", "PART "])
            ):
                continue

            seen.add(sec_num)
            sections.append({
                "section_number": sec_num,
                "title": f"Section {sec_num} - {sec_title}",
                "raw_title": sec_title,
            })

    def sort_key(s):
        m = re.match(r"^(\d+)", s["section_number"])
        return int(m.group(1)) if m else 99999

    return sorted(sections, key=sort_key)


def main():
    print("==========================================")
    print("EXTRACTOR COMPARISON AUDIT: www.indiacode.nic.in (verify=True)")
    print("PyPDF2 (Pure Python) vs PyMuPDF (fitz)")
    print("==========================================")

    cache_dir = os.path.join("scratch", "pdf_cache")

    for act in TARGET_ACTS:
        name = act["name"]
        file_name = act["file_name"]
        file_path = os.path.join(cache_dir, file_name)

        print(f"\n------------------------------------------")
        print(f"Act: {name}")

        pdf_bytes = None
        if os.path.exists(file_path):
            with open(file_path, "rb") as f:
                pdf_bytes = f.read()

        if not pdf_bytes:
            print(f"  Result: PDF file {file_name} not found in scratch cache.")
            continue

        text_pypdf2 = extract_pdf_text_pypdf2(pdf_bytes)
        text_fitz = extract_pdf_text_fitz(pdf_bytes)

        sec_pypdf2 = extract_sections(text_pypdf2)
        sec_fitz = extract_sections(text_fitz)

        print(f"  PDF Size: {len(pdf_bytes)} bytes")
        print(f"  PyPDF2 (Pure Python): {len(text_pypdf2.strip())} chars | Sections Extracted: {len(sec_pypdf2)}")
        print(f"  PyMuPDF (fitz C):     {len(text_fitz.strip())} chars | Sections Extracted: {len(sec_fitz)}")

        print("\n  Sample 5 Sections Extracted by PyPDF2:")
        if sec_pypdf2:
            for s in sec_pypdf2[:5]:
                print(f"    • Section {s['section_number']}: {s['raw_title']}")
        else:
            print("    [0 sections matched with PyPDF2 text]")

        print("\n  Sample 5 Sections Extracted by PyMuPDF (fitz):")
        if sec_fitz:
            for s in sec_fitz[:5]:
                print(f"    • Section {s['section_number']}: {s['raw_title']}")
        else:
            print("    [0 sections matched with fitz text]")


if __name__ == "__main__":
    main()
