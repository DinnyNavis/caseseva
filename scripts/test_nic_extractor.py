import re
import sys
import os
import PyPDF2
import fitz

sys.stdout.reconfigure(encoding="utf-8")

ACTS_TO_TEST = [
    {"name": "Code on Wages, 2019", "file_name": "Code_on_Wages_2019_Act_No_29.pdf"},
    {"name": "Bharatiya Nyaya Sanhita, 2023", "file_name": "Bharatiya_Nyaya_Sanhita_2023.pdf"},
    {"name": "Transfer of Property Act, 1882", "file_name": "Transfer_of_Property_Act_1882.pdf"},
    {"name": "Indian Contract Act, 1872", "file_name": "Indian_Contract_Act_1872.pdf"},
    {"name": "Specific Relief Act, 1963", "file_name": "Specific_Relief_Act_1963.pdf"},
    {"name": "Indian Evidence Act, 1872", "file_name": "Indian_Evidence_Act_1872.pdf"},
    {"name": "Code of Civil Procedure, 1908", "file_name": "Code_of_Civil_Procedure_1908.pdf"},
]

def extract_pdf_text_pypdf2(file_path: str) -> str:
    reader = PyPDF2.PdfReader(file_path)
    text = ""
    for page in reader.pages:
        t = page.extract_text()
        if t:
            text += t + "\n"
    return text

def extract_sections(full_text: str) -> list[dict[str, str]]:
    sections = []
    seen = set()

    pattern1 = re.compile(
        r"(?:^|\n)\s*(\d+[A-Z]?(?:\([0-9a-z]+\))?)\.\s*([A-Z][^\n\r]{2,120}?)(?:\.|\s*[\-–—]|\n)",
        re.MULTILINE
    )
    pattern2 = re.compile(
        r"(?:^|\n)\s*(?:Section|Sec\.)\s*(\d+[A-Z]?(?:\([0-9a-z]+\))?)\.?\s*[\-–—:]?\s*([A-Z][^\n\r]{2,120}?)(?:\.|\s*[\-–—]|\n)",
        re.MULTILINE
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
    print("COMPARATIVE AUDIT: PyPDF2 (Pure Python) vs PyMuPDF (fitz)")
    print("==========================================")

    cache_dir = os.path.join("scratch", "pdf_cache")

    for item in ACTS_TO_TEST:
        name = item["name"]
        file_name = item["file_name"]
        file_path = os.path.join(cache_dir, file_name)

        print(f"\n------------------------------------------")
        print(f"Act: {name}")

        if not os.path.exists(file_path):
            print(f"  Result: File {file_name} not found in scratch cache.")
            continue

        # Test PyPDF2 (Pure Python - 100% Lambda safe, zero binary dependencies)
        text_pypdf2 = extract_pdf_text_pypdf2(file_path)
        sec_pypdf2 = extract_sections(text_pypdf2)

        # Test PyMuPDF fitz
        doc = fitz.open(file_path)
        text_fitz = "\n".join(page.get_text() for page in doc)
        sec_fitz = extract_sections(text_fitz)

        print(f"  PyPDF2 (Pure Python): {len(text_pypdf2.strip())} chars | Sections Found: {len(sec_pypdf2)}")
        print(f"  PyMuPDF (fitz binary): {len(text_fitz.strip())} chars | Sections Found: {len(sec_fitz)}")

        if sec_pypdf2:
            print("  Sample 5 Sections (PyPDF2):")
            for s in sec_pypdf2[:5]:
                print(f"    • Section {s['section_number']}: {s['raw_title']}")

if __name__ == "__main__":
    main()
