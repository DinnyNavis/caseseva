import re
import sys
import os
import requests
import PyPDF2
import fitz

sys.stdout.reconfigure(encoding="utf-8")

BASE_HOST = "https://indiacode.gov.in"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

ACTS = [
    {
        "name": "Code on Wages, 2019",
        "query": "Code on Wages 2019",
        "file_name": "Code_on_Wages_2019_Full.pdf",
    },
    {
        "name": "Bharatiya Nyaya Sanhita, 2023",
        "query": "Bharatiya Nyaya Sanhita 2023",
        "file_name": "Bharatiya_Nyaya_Sanhita_2023_Full.pdf",
    },
    {
        "name": "Transfer of Property Act, 1882",
        "query": "Transfer of Property Act 1882",
        "file_name": "Transfer_of_Property_Act_1882_Full.pdf",
    },
]


def extract_pdf_text_pypdf2(pdf_bytes: bytes) -> str:
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
    print("COMPARATIVE PDF AUDIT: PyPDF2 (Pure Python) vs PyMuPDF (fitz)")
    print("==========================================")

    cache_dir = os.path.join("scratch", "pdf_cache")
    os.makedirs(cache_dir, exist_ok=True)

    for item in ACTS:
        name = item["name"]
        file_name = item["file_name"]
        cache_path = os.path.join(cache_dir, file_name)

        print(f"\n------------------------------------------")
        print(f"Act: {name}")

        pdf_bytes = None
        if os.path.exists(cache_path):
            with open(cache_path, "rb") as f:
                pdf_bytes = f.read()

        if not pdf_bytes:
            search_query = item["query"]
            search_url = f"{BASE_HOST}/server/api/discover/search/objects?query={requests.utils.quote(search_query)}"
            try:
                r = requests.get(search_url, headers=HEADERS, timeout=15, verify=True)
                if r.status_code == 200:
                    objs = r.json().get("_embedded", {}).get("searchResult", {}).get("_embedded", {}).get("objects", [])
                    for obj in objs:
                        indexable = obj.get("_embedded", {}).get("indexableObject", {})
                        item_uuid = indexable.get("uuid")
                        if not item_uuid:
                            continue
                        bundles_url = f"{BASE_HOST}/server/api/core/items/{item_uuid}/bundles"
                        r_b = requests.get(bundles_url, headers=HEADERS, timeout=10, verify=True)
                        if r_b.status_code == 200:
                            bundles = r_b.json().get("_embedded", {}).get("bundles", [])
                            for bundle in bundles:
                                bit_href = bundle.get("_links", {}).get("bitstreams", {}).get("href")
                                if bit_href:
                                    r_bits = requests.get(bit_href, headers=HEADERS, timeout=10, verify=True)
                                    if r_bits.status_code == 200:
                                        bits = r_bits.json().get("_embedded", {}).get("bitstreams", [])
                                        for bit in bits:
                                            b_name = bit.get("name", "")
                                            if b_name.endswith(".pdf") and not b_name.endswith(".jpg"):
                                                dl_url = bit.get("_links", {}).get("content", {}).get("href")
                                                r_dl = requests.get(dl_url, headers=HEADERS, timeout=30, verify=True)
                                                if r_dl.status_code == 200 and len(r_dl.content) > 10000:
                                                    pdf_bytes = r_dl.content
                                                    with open(cache_path, "wb") as f:
                                                        f.write(pdf_bytes)
                                                    print(f"  Downloaded full PDF from {dl_url} ({len(pdf_bytes)} bytes)")
                                                    break
                                if pdf_bytes:
                                    break
                        if pdf_bytes:
                            break
            except Exception as exc:
                print(f"  Download error for {name}: {exc}")

        if not pdf_bytes:
            print("  Result: Could not locate full Act PDF stream.")
            continue

        text_pypdf2 = extract_pdf_text_pypdf2(pdf_bytes)
        text_fitz = extract_pdf_text_fitz(pdf_bytes)

        sec_pypdf2 = extract_sections(text_pypdf2)
        sec_fitz = extract_sections(text_fitz)

        print(f"  PDF Size: {len(pdf_bytes)} bytes")
        print(f"  PyPDF2 (Pure Python): {len(text_pypdf2.strip())} chars | Sections Extracted: {len(sec_pypdf2)}")
        print(f"  PyMuPDF (fitz C):     {len(text_fitz.strip())} chars | Sections Extracted: {len(sec_fitz)}")

        print("\n  Sample 5 Sections (PyPDF2):")
        if sec_pypdf2:
            for s in sec_pypdf2[:5]:
                print(f"    • Section {s['section_number']}: {s['raw_title']}")
        else:
            print("    [0 sections matched with PyPDF2]")

        print("\n  Sample 5 Sections (PyMuPDF fitz):")
        if sec_fitz:
            for s in sec_fitz[:5]:
                print(f"    • Section {s['section_number']}: {s['raw_title']}")
        else:
            print("    [0 sections matched with fitz]")


if __name__ == "__main__":
    main()
