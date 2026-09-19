# CaseSeva AI - Infrastructure & Deployment Guide (Phase 3)

This document provides complete, step-by-step instructions for deploying the CaseSeva AI backend (FastAPI on AWS Lambda + HTTP API Gateway) and frontend (AWS Amplify Hosting) in region `ap-southeast-2`, extending the existing `caseseva-infra-dev` SAM stack.

---

## Prerequisites

1. **AWS CLI** installed and configured (`aws configure`) for region `ap-southeast-2`.
2. **AWS SAM CLI** installed (`sam --version`).
3. **Node.js 18+ & npm** installed (`npm --version`).
4. **Python 3.12** installed (`python --version`).

---

## IAM Role vs. Bedrock Bearer Token

- **Is a Bearer Token Required on AWS Lambda?** NO.
- **Why IAM Role is Preferred:** Hardcoding or passing a bearer token as an environment variable in CloudFormation is insecure and relies on temporary local evaluation tokens. In AWS Lambda, standard `boto3.client('bedrock-runtime')` automatically signs API calls via AWS SigV4 using the Lambda Execution Role credentials.
- **IAM Policy:** The SAM template automatically attaches an IAM policy granting `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on Bedrock foundation models and inference profiles to the Lambda execution role.

---

## Asynchronous Pipeline Execution & API Gateway Timeout

- **API Gateway Limit:** API Gateway has a non-configurable HTTP response timeout limit of 29 seconds. The legal analysis pipeline makes ~12 sequential Bedrock calls taking 40–60 seconds.
- **Lambda Async Mechanism:** When deployed on AWS Lambda, triggering `/api/cases/{id}/analyze` or `/api/cases/{id}/legal-analysis` causes the function to invoke itself asynchronously (`InvocationType='Event'`).
- The HTTP endpoint returns HTTP 200 `{"status": "started"}` in < 150ms, while the background Lambda execution context runs the analysis pipeline for up to 15 minutes (`Timeout: 900`), updating DynamoDB status progressively (`ANALYZING` → `AWAITING_PREVIEW_1` / `AWAITING_PREVIEW_2`).
- **Lambda Retry Behavior:** The function is configured with `MaximumRetryAttempts: 0` for async invocations. This prevents automatic AWS Lambda retries from running the pipeline multiple times or double-writing to DynamoDB if a transient network error occurs during a multi-stage Bedrock run.

---

## Two-Pass Deployment Order (CORS Configuration)

Due to the CORS dependency between API Gateway and Amplify Hosting, deployment follows a **two-pass order**:

### Pass 1: Deploy Backend Infrastructure to Get API Gateway Endpoint

Run the following commands from the project root (`d:\AWSHACK`):

```powershell
# 1. Validate the SAM template
sam validate -t infrastructure/template.yaml

# 2. Build the serverless application
sam build -t infrastructure/template.yaml

# 3. Strip non-backend files from the build artifact (SAM copies the entire project root)
#    This reduces the Lambda package from ~114 MB to ~37 MB.
$artifact = ".aws-sam\build\CaseSevaFunction"
foreach ($d in @('node_modules','frontend','tests','test-results','fixtures','.localdev','.kilo','artifacts','infrastructure','scripts')) {
    if (Test-Path "$artifact\$d") { Remove-Item -Recurse -Force "$artifact\$d" }
}
foreach ($f in @('.env.example','.samignore','DEPLOY.md','Makefile','package-lock.json','package.json','playwright.config.js','README.md','requirements.txt')) {
    if (Test-Path "$artifact\$f") { Remove-Item -Force "$artifact\$f" }
}

# 4. Deploy Pass 1 (with default CORS origin)
sam deploy `
  --stack-name caseseva-infra-dev `
  --region ap-southeast-2 `
  --capabilities CAPABILITY_IAM `
  --resolve-s3 `
  --parameter-overrides Environment=dev
```

After Pass 1 completes, note the **`ApiEndpoint`** output URL (e.g., `https://abc123xyz.execute-api.ap-southeast-2.amazonaws.com`).

---

### Step 2: Deploy Frontend to AWS Amplify Hosting

1. Navigate to the `frontend/` directory and build the frontend with the live API URL:
   ```powershell
   cd frontend
   
   # Windows PowerShell env variable injection for build:
   $env:VITE_API_BASE_URL="https://<YOUR_API_GATEWAY_ID>.execute-api.ap-southeast-2.amazonaws.com"
   npm run build
   ```
2. Initialize or deploy to **AWS Amplify Hosting**:
   ```powershell
   # Option A: AWS Amplify CLI
   amplify init
   amplify add hosting
   amplify publish

   # Option B: AWS CLI Amplify App Manual Zip Upload
   aws amplify create-app --name caseseva-frontend --region ap-southeast-2
   ```
3. Copy your live Amplify application URL (e.g., `https://main.d12345.amplifyapp.com`).

> [!IMPORTANT]
> **Exact CORS Origin Format**: The origin URL passed to SAM must match **EXACTLY**:
> - Must include `https://`
> - Must NOT include a trailing slash `/`
> - Example: `https://main.d12345.amplifyapp.com`

---

### Pass 2: Redeploy SAM Stack with Real Amplify Origin

Redeploy CloudFormation to update CORS policies with your live frontend origin:

```powershell
cd d:\AWSHACK

sam deploy `
  --stack-name caseseva-infra-dev `
  --region ap-southeast-2 `
  --capabilities CAPABILITY_IAM `
  --resolve-s3 `
  --parameter-overrides Environment=dev AllowedOrigin=https://<YOUR_AMPLIFY_APP_ID>.amplifyapp.com
```

---

## Post-Deploy Smoke Test & Troubleshooting

### 1. Smoke Test via Live API

Verify that async Lambda self-invocation triggers the analysis pipeline and progresses cleanly:

```powershell
# Set your live API Gateway endpoint
$API="https://<YOUR_API_GATEWAY_ID>.execute-api.ap-southeast-2.amazonaws.com"

# 1. Create a Test User Signup
$signup = Invoke-RestMethod -Uri "$API/api/auth/signup" -Method Post -ContentType "application/json" -Body '{"full_name":"Live Client","email":"smoke-test@example.com","mobile_number":"9876543210","password":"Password123","preferred_language":"English","state":"Delhi","district_city":"Delhi"}'
$token = $signup.session_token
$headers = @{ Authorization = "Bearer $token" }

# 2. Create a Case
$case = Invoke-RestMethod -Uri "$API/api/cases" -Method Post -Headers $headers
$caseId = $case.case.case_id

# 3. Update Story
Invoke-RestMethod -Uri "$API/api/cases/$caseId" -Method Patch -Headers $headers -ContentType "application/json" -Body '{"stage":"NEW_CONSULTATION","stage_details":{},"client_story":"I purchased a laptop online on 1 August 2026 for Rs. 78,999. It stopped working on 7 August. The service centre found a motherboard fault, but the seller refused replacement."}'

# 4. Submit Case
Invoke-RestMethod -Uri "$API/api/cases/$caseId/submit" -Method Post -Headers $headers

# 5. Trigger Analysis (Asynchronous Lambda Event)
Invoke-RestMethod -Uri "$API/api/cases/$caseId/analyze" -Method Post -Headers $headers

# 6. Poll Status until AWAITING_PREVIEW_1
for ($i=0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 3
    $status = (Invoke-RestMethod -Uri "$API/api/cases/$caseId/status" -Method Get -Headers $headers).status
    Write-Host "Current Status: $status"
    if ($status -eq "AWAITING_PREVIEW_1") {
        Write-Host "SMOKE TEST PASSED! Case reached AWAITING_PREVIEW_1" -ForegroundColor Green
        break
    }
}
```

### 2. Troubleshooting & CloudWatch Logs

If the status remains stuck in `ANALYZING` or reaches `ANALYSIS_FAILED`:

1. Open **CloudWatch Console** -> **Log Groups**.
2. Find Log Group: `/aws/lambda/caseseva-backend-dev`.
3. Look for recent log streams containing `[Bedrock LLM Boto3]` or `Processing async Lambda event action='run_pipeline'`.

---

## Idle Cost Breakdown

When idle, total infrastructure cost is **~$0.00 / month**:

| Component | Pricing Model | Idle Cost |
| :--- | :--- | :--- |
| **DynamoDB** | On-Demand (`PAY_PER_REQUEST`) | $0.00 / month |
| **AWS Lambda** | Per execution / duration (1M free calls/mo) | $0.00 / month |
| **HTTP API Gateway** | Per request (300M free requests/mo) | $0.00 / month |
| **Amazon Bedrock** | Pay per input/output token | $0.00 / month |
| **S3 Storage** | $0.023 / GB per month | ~$0.00 to $0.02 / month |
| **Amplify Hosting** | AWS Free Tier (1,000 build min / 5GB storage) | $0.00 / month |

---

## Teardown Instructions & Important Warning

> [!CAUTION]
> **Teardown Warning for `sam delete`**:
> An S3 bucket containing objects cannot be deleted by CloudFormation and will cause `sam delete` to fail with a `BucketNotEmpty` error.
> 
> **Before running `sam delete`**, you MUST empty the S3 bucket using the AWS CLI:
> ```powershell
> # 1. Empty the S3 bucket first
> aws s3 rm s3://caseseva-storage-dev-<AccountId> --recursive --region ap-southeast-2
> 
> # 2. Delete the CloudFormation stack
> sam delete --stack-name caseseva-infra-dev --region ap-southeast-2 --no-prompts
> ```
