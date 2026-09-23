import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.adapters.legal_retrieval import normalize_domain_to_corpus
from backend.adapters.real.legal_retrieval import RealLegalRetrievalAdapter

def test_normalization():
    test_cases = [
        ("Labor", "labour"),
        ("Wages and Salary Disputes", "labour"),
        ("Labour / Employment", "labour"),
        ("employment and labor", "labour"),
        ("Consumer", "consumer"),
        ("Consumer Protection", "consumer"),
        ("Defective Goods", "consumer"),
        ("Taxation", None),
    ]
    print("=== TESTING DOMAIN NORMALIZATION LAYER ===")
    for domain, expected in test_cases:
        resolved = normalize_domain_to_corpus(domain)
        print(f"Input: '{domain}' -> Resolved: '{resolved}' (Expected: '{expected}')")
        assert resolved == expected, f"Failed for '{domain}'"
    print("All domain normalization test cases PASSED!\n")

def test_real_retrieval():
    adapter = RealLegalRetrievalAdapter()
    print("=== TESTING REAL LEGAL RETRIEVAL ADAPTER WITH 'Labor' ===")
    res_labor = adapter.search("unpaid salary wages non-payment", limit=5, domain="Labor")
    print(f"Domain 'Labor' retrieved {len(res_labor)} provisions:")
    for p in res_labor:
        print(f"  - [{p['provision_id']}] {p['title']}")
    assert len(res_labor) > 0, "Failed to retrieve provisions for domain 'Labor'"
    assert any("WAGES" in p['provision_id'] for p in res_labor), "Did not find Code on Wages provisions"
    print("Real retrieval test for 'Labor' PASSED!\n")

if __name__ == "__main__":
    test_normalization()
    test_real_retrieval()
