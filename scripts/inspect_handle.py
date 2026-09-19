import requests
import re

r = requests.get("https://indiacode.gov.in/handle/123456789/2338", headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
print("Page length:", len(r.text))
print("Sample page text:")
print(r.text[:3000])

# Look for all hrefs or api endpoints
links = re.findall(r'href="([^"]+)"', r.text)
print("\nFound links:")
for l in links[:30]:
    print(" -", l)
