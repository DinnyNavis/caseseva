import requests
import re

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
})

# Try handle or act search on indiacode.gov.in
urls_to_test = [
    "https://indiacode.gov.in",
    "https://indiacode.gov.in/handle/123456789/13444",
    "https://indiacode.gov.in/handle/123456789/2338",
    "https://indiacode.gov.in/handle/123456789/2187",
    "https://indiacode.gov.in/handle/123456789/1583",
    "https://indiacode.gov.in/handle/123456789/2188",
    "https://indiacode.gov.in/handle/123456789/2191",
    "https://indiacode.gov.in/handle/123456789/19875",
]

for url in urls_to_test:
    try:
        r = session.get(url, allow_redirects=True, timeout=10)
        print(f"URL: {url}")
        print(f" -> Final URL: {r.url}")
        print(f" -> Status: {r.status_code} | Length: {len(r.content)}")
        if r.status_code == 200:
            title = re.search(r"<title>(.*?)</title>", r.text, re.I)
            print(f" -> Title: {title.group(1).strip() if title else 'No title'}")
            pdf_matches = re.findall(r'href="([^"]+\.pdf[^"]*)"', r.text, re.I)
            if pdf_matches:
                print(f" -> PDF Links found: {pdf_matches[:3]}")
    except Exception as e:
        print(f"URL: {url} -> Error: {e}")
    print("-" * 50)
