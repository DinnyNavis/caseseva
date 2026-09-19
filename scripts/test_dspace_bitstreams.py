import requests
import json

headers = {"User-Agent": "Mozilla/5.0"}

queries = [
    ("Code on Wages 2019", "wages 2019"),
    ("Bharatiya Nyaya Sanhita 2023", "Bharatiya Nyaya Sanhita"),
    ("Transfer of Property Act 1882", "Transfer of Property Act"),
    ("Indian Contract Act 1872", "Indian Contract Act"),
    ("Specific Relief Act 1963", "Specific Relief Act"),
    ("Indian Evidence Act 1872", "Indian Evidence Act"),
    ("Code of Civil Procedure 1908", "Code of Civil Procedure"),
]

for label, q in queries:
    url = f"https://indiacode.gov.in/server/api/discover/search/objects?query={requests.utils.quote(q)}"
    r = requests.get(url, headers=headers, timeout=10)
    print(f"\n==========================================")
    print(f"Query: '{q}' ({label})")
    if r.status_code == 200:
        data = r.json()
        objects = data.get("_embedded", {}).get("searchResult", {}).get("_embedded", {}).get("objects", [])
        print(f"Total search hits: {len(objects)}")
        for i, obj in enumerate(objects[:3]):
            indexable = obj.get("_embedded", {}).get("indexableObject", {})
            title = indexable.get("name") or indexable.get("metadata", {}).get("dc.title", [{}])[0].get("value", "No title")
            handle = indexable.get("handle")
            item_uuid = indexable.get("uuid")
            print(f" [{i+1}] Title: {title}")
            print(f"     Handle: https://indiacode.gov.in/handle/{handle}")
            print(f"     UUID: {item_uuid}")
            
            # Fetch bitstreams for this item via DSpace API
            if item_uuid:
                b_url = f"https://indiacode.gov.in/server/api/core/items/{item_uuid}/bundles"
                r_b = requests.get(b_url, headers=headers, timeout=10)
                if r_b.status_code == 200:
                    bundles = r_b.json().get("_embedded", {}).get("bundles", [])
                    for bundle in bundles:
                        b_name = bundle.get("name")
                        bitstream_link = bundle.get("_links", {}).get("bitstreams", {}).get("href")
                        if bitstream_link:
                            r_bits = requests.get(bitstream_link, headers=headers, timeout=10)
                            if r_bits.status_code == 200:
                                bitstreams = r_bits.json().get("_embedded", {}).get("bitstreams", [])
                                for bit in bitstreams:
                                    name = bit.get("name")
                                    download_url = bit.get("_links", {}).get("content", {}).get("href")
                                    print(f"     -> Bitstream File: {name} | Download: {download_url}")
