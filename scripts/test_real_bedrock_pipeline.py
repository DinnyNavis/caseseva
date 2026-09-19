import os
import sys
import json
from pathlib import Path

# Ensure root workspace is in sys.path
sys.path.insert(0, os.path.abspath("."))

from dotenv import load_dotenv
load_dotenv()

# Force USE_REAL_LLM=true for this test script
os.environ["USE_REAL_LLM"] = "true"

from backend.main import app
from backend.adapters.factory import load_adapters
from backend.services.analysis import run_pipeline
from backend.services.legal_analysis import run_legal_pipeline

def main():
    print("=" * 80)
    print("STARTING E2E BEDROCK PIPELINE TEST FOR LAPTOP DISPUTE CASE")
    print("Model ID:", os.getenv("BEDROCK_MODEL_ID"))
    print("Region:", os.getenv("AWS_REGION"))
    print("USE_REAL_LLM:", os.environ.get("USE_REAL_LLM"))
    print("=" * 80)

    app.state.adapters = load_adapters()
    db = app.state.adapters.database
    llm = app.state.adapters.llm
    
    # Create the laptop-dispute demo case
    case_id = "laptop-dispute-real-bedrock-001"
    case_data = {
        "id": case_id,
        "case_id": case_id,
        "owner_user_id": "test-user-001",
        "status": "READY_FOR_ANALYSIS",
        "created_at": "2026-08-10T10:00:00Z",
        "stage": "NEW_CONSULTATION",
        "stage_details": {},
        "client_story": (
            "I purchased a gaming laptop online for Rs. 78,999 on 1 August 2026 for personal use. "
            "The laptop was delivered on 3 August 2026. However, starting 7 August 2026, it began shutting down repeatedly. "
            "I brought it to an authorized service centre, and the job sheet states a motherboard fault. "
            "I contacted the seller requesting a full replacement as per the return policy for manufacturing defects, "
            "but the seller refused replacement and offered only repair."
        ),
        "evidence": [
            {
                "evidence_id": "E001",
                "filename": "purchase_invoice.pdf",
                "content_type": "application/pdf",
                "size": 1024,
                "storage_key": f"cases/{case_id}/E001-purchase_invoice.pdf",
                "url": f"/api/cases/{case_id}/evidence/E001",
                "description": "Purchase invoice for gaming laptop Rs. 78,999 delivered 3 Aug 2026",
                "uploaded_at": "2026-08-10T10:00:00Z",
            },
            {
                "evidence_id": "E002",
                "filename": "service_jobsheet.pdf",
                "content_type": "application/pdf",
                "size": 2048,
                "storage_key": f"cases/{case_id}/E002-service_jobsheet.pdf",
                "url": f"/api/cases/{case_id}/evidence/E002",
                "description": "Authorized service centre job sheet showing motherboard fault dated 7 Aug 2026",
                "uploaded_at": "2026-08-10T10:05:00Z",
            },
            {
                "evidence_id": "E003",
                "filename": "seller_refusal_email.pdf",
                "content_type": "application/pdf",
                "size": 1500,
                "storage_key": f"cases/{case_id}/E003-seller_refusal_email.pdf",
                "url": f"/api/cases/{case_id}/evidence/E003",
                "description": "Email correspondence where seller refused replacement and offered only repair",
                "uploaded_at": "2026-08-10T10:10:00Z",
            }
        ],
        "facts": [],
        "timeline": [],
        "legal_issues": [],
        "legal_sections": [],
        "arguments": {},
        "stage_statuses": {},
        "version": 1,
    }

    # Delete previous test run case if present
    if db.get("cases", case_id):
        db.delete("cases", case_id)

    # Save to database adapter
    db.create("cases", case_data)

    print("\n--- RUNNING ANALYSIS PIPELINE ---")
    try:
        run_pipeline(app, case_id)
    except Exception as e:
        print(f"Analysis Pipeline Exception: {e}")

    updated_case = db.get("cases", case_id)
    print("Analysis Status:", updated_case.get("status"))
    print("Stage Statuses:", updated_case.get("stage_statuses"))
    if updated_case.get("analysis_error"):
        print("Analysis Error:", updated_case.get("analysis_error"))

    print("\n--- RUNNING LEGAL ANALYSIS PIPELINE ---")
    try:
        run_legal_pipeline(app, case_id)
    except Exception as e:
        print(f"Legal Analysis Pipeline Exception: {e}")

    final_case = db.get("cases", case_id)
    print("Final Status:", final_case.get("status"))
    print("Final Stage Statuses:", final_case.get("stage_statuses"))
    if final_case.get("legal_analysis_error"):
        print("Legal Analysis Error:", final_case.get("legal_analysis_error"))

    print("\n" + "=" * 80)
    print("STAGE BY STAGE EXECUTION REPORT")
    print("=" * 80)

    first_time_pass = []
    retry_pass = []
    failed_outright = []

    for entry in getattr(llm, "stage_logs", []):
        stg = entry["stage"].upper()
        status = entry["final_status"]
        if status == "PASSED_FIRST_TIME":
            first_time_pass.append(stg)
            print(f"\n[PASS 1st TRY] Stage: {stg}")
            print(f"  Attempt 1 Tokens: in={entry['attempt_1']['input_tokens']}, out={entry['attempt_1']['output_tokens']}")
            print(f"  Sample Cleaned JSON: {entry['attempt_1']['cleaned'][:200]}...")
        elif status == "PASSED_ON_RETRY":
            retry_pass.append(stg)
            print(f"\n[PASS ON RETRY] Stage: {stg}")
            print(f"  Attempt 1 Error: {entry['attempt_1']['error']}")
            print(f"  Attempt 1 Raw Output:\n{entry['attempt_1']['raw']}")
            print(f"  Attempt 2 Tokens: in={entry['attempt_2']['input_tokens']}, out={entry['attempt_2']['output_tokens']}")
            print(f"  Attempt 2 Cleaned JSON: {entry['attempt_2']['cleaned'][:200]}...")
        else:
            failed_outright.append((stg, entry))
            print(f"\n[FAILED OUTRIGHT] Stage: {stg}")
            print(f"  Attempt 1 Error: {entry['attempt_1']['error']}")
            print(f"  Attempt 1 Raw Output:\n{entry['attempt_1']['raw']}")
            if entry.get("attempt_2"):
                print(f"  Attempt 2 Error: {entry['attempt_2']['error']}")
                print(f"  Attempt 2 Raw Output:\n{entry['attempt_2']['raw']}")
            print(f"  Expected Pydantic Schema:\n{json.dumps(entry['expected_schema'], indent=2)}")

    print("\n" + "=" * 80)
    print("SUMMARY SUMMARY REPORT")
    print("=" * 80)
    print(f"Stages Passed First Time ({len(first_time_pass)}): {', '.join(first_time_pass) if first_time_pass else 'None'}")
    print(f"Stages Needed Retry ({len(retry_pass)}): {', '.join(retry_pass) if retry_pass else 'None'}")
    print(f"Stages Failed Outright ({len(failed_outright)}): {', '.join([f[0] for f in failed_outright]) if failed_outright else 'None'}")
    
    in_tok = getattr(llm, "total_input_tokens", 0)
    out_tok = getattr(llm, "total_output_tokens", 0)
    total_tok = in_tok + out_tok
    # Anthropic Claude 3.5 / Haiku pricing on Bedrock: $0.001 per 1k input tokens, $0.005 per 1k output tokens
    cost_in = (in_tok / 1000.0) * 0.001
    cost_out = (out_tok / 1000.0) * 0.005
    total_cost = cost_in + cost_out

    print(f"\nTotal Input Tokens: {in_tok}")
    print(f"Total Output Tokens: {out_tok}")
    print(f"Total Tokens: {total_tok}")
    print(f"Estimated Cost: ${total_cost:.5f} USD (Input: ${cost_in:.5f}, Output: ${cost_out:.5f})")
    print("=" * 80)

    print("\n" + "=" * 80)
    print("VERIFIED LEGAL SECTIONS SELECTED IN REAL BEDROCK RUN")
    print("=" * 80)
    verified = final_case.get("verified_legal_sections", [])
    if verified:
        for idx, sec in enumerate(verified, 1):
            print(f"{idx}. ID: {sec.get('provision_id')} | Title: {sec.get('title')} | Source: {sec.get('source_url')}")
    else:
        print("No verified provisions returned.")
    print("=" * 80)


    # Save summary report to JSON for precise reading
    report_file = Path("artifacts/real_bedrock_run_report.json")
    report_file.parent.mkdir(parents=True, exist_ok=True)
    report_file.write_text(json.dumps({
        "first_time_pass": first_time_pass,
        "retry_pass": retry_pass,
        "failed_outright": [f[0] for f in failed_outright],
        "total_input_tokens": in_tok,
        "total_output_tokens": out_tok,
        "total_cost_usd": total_cost,
        "logs": getattr(llm, "stage_logs", [])
    }, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
