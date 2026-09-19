import os
import json
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from dotenv import load_dotenv

def test_model(region, bearer_token, model_id):
    encoded_model_id = urllib.parse.quote(model_id, safe="")
    url = f"https://bedrock-runtime.{region}.amazonaws.com/model/{encoded_model_id}/invoke"
    headers = {
        "Authorization": f"Bearer {bearer_token}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 100,
        "messages": [
            {
                "role": "user",
                "content": "Ping test. Respond strictly with JSON: {\"status\": \"ok\", \"message\": \"Bedrock is working\"}"
            }
        ]
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        print(f"Testing model_id: '{model_id}' -> URL: {url}")
        with urllib.request.urlopen(req) as resp:
            status_code = resp.getcode()
            response_bytes = resp.read()
            response_json = json.loads(response_bytes.decode("utf-8"))
            print(f" SUCCESS! Status: {status_code}")
            print(f"Response Body:\n{json.dumps(response_json, indent=2)}")
            return True, response_json
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8")
        print(f" FAILED HTTP {exc.code}: {exc.reason} - {error_body.strip()}")
        return False, error_body
    except Exception as exc:
        print(f" FAILED Request error: {exc}")
        return False, str(exc)

def main():
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(dotenv_path=env_path)

    bearer_token = os.getenv("AWS_BEARER_TOKEN_BEDROCK")
    region = os.getenv("AWS_REGION", "ap-southeast-2")
    configured_model_id = os.getenv("BEDROCK_MODEL_ID", "apac.anthropic.claude-haiku-4-5-20251001-v1:0")

    print(f"Region: {region}")
    print(f"Configured BEDROCK_MODEL_ID: {configured_model_id}")
    print(f"Bearer Token Present: {bool(bearer_token)}")

    if not bearer_token:
        print("ERROR: AWS_BEARER_TOKEN_BEDROCK is not set in environment.")
        return

    # First test configured model ID
    ok, res = test_model(region, bearer_token, configured_model_id)
    if not ok:
        print("\nTesting 'au.anthropic.claude-haiku-4-5-20251001-v1:0'...")
        ok, res = test_model(region, bearer_token, "au.anthropic.claude-haiku-4-5-20251001-v1:0")
        if not ok:
            print("\nTesting 'au.anthropic.claude-sonnet-4-5-20250929-v1:0'...")
            ok, res = test_model(region, bearer_token, "au.anthropic.claude-sonnet-4-5-20250929-v1:0")

if __name__ == "__main__":
    main()
