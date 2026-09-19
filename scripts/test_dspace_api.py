import requests

headers = {"User-Agent": "Mozilla/5.0"}
api_urls = [
    "https://indiacode.gov.in/server/api",
    "https://indiacode.gov.in/server/api/core/items",
    "https://indiacode.gov.in/server/api/discover/search/objects?query=wages",
    "https://indiacode.gov.in/server/api/discover/search/objects?query=property",
    "https://indiacode.gov.in/server/api/discover/search/objects?query=contract",
]

for url in api_urls:
    try:
        r = requests.get(url, headers=headers, timeout=10)
        print(f"URL: {url} -> Status: {r.status_code}")
        if r.status_code == 200:
            print("Response Sample:", r.text[:500])
    except Exception as e:
        print(f"URL: {url} -> Error: {e}")
    print("-" * 50)
