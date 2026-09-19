import sys
import os
import unittest

sys.path.insert(0, os.path.abspath("."))

from backend.adapters.authorised_sources import is_authorised_url, validate_authorised_url

class TestAuthorisedSources(unittest.TestCase):
    def test_allowlisted_urls(self):
        valid_urls = [
            "https://www.indiacode.nic.in/handle/123456789/2338",
            "https://indiacode.nic.in/handle/123456789/13444",
            "https://sci.gov.in/judgments/2023/sample.pdf",
            "https://ecourts.gov.in/cause_list.pdf",
            "https://consumeraffairs.gov.in/rules.pdf",
            "https://egazette.nic.in/notification.pdf",
        ]
        for url in valid_urls:
            self.assertTrue(is_authorised_url(url), f"Should allow valid URL: {url}")
            self.assertEqual(validate_authorised_url(url), url)

    def test_refused_unauthorized_urls(self):
        invalid_urls = [
            "https://indiacode.gov.in/server/api/core/bitstreams/123/content",
            "https://lawblogs.example.com/cpa2019_guide.html",
            "https://randomlegalwiki.org/section45",
            "https://blog.legalaggregators.in/summary",
            "http://untrusted-domain.com/pdf",
        ]
        for url in invalid_urls:
            self.assertFalse(is_authorised_url(url), f"Should refuse invalid URL: {url}")
            with self.assertRaises(ValueError):
                validate_authorised_url(url)

if __name__ == "__main__":
    unittest.main()
