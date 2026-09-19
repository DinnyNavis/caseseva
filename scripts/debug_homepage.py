import requests

r = requests.get("https://www.indiacode.nic.in/", headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
print("Homepage HTML sample:")
print(r.text[:2000])
