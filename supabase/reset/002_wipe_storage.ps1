$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_SERVICE_ROLE_KEY) {
  throw "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script."
}

$headers = @{
  apikey = $env:SUPABASE_SERVICE_ROLE_KEY
  Authorization = "Bearer $($env:SUPABASE_SERVICE_ROLE_KEY)"
}

$buckets = @(
  "organization-logos", "profile-photos", "claim-attachments",
  "leave-documents", "dpr-photos", "attendance-selfies", "communication-media", "task-attachments",
  "message-attachments", "vendor-bills", "material-documents",
  "fuel-receipts", "vendor-contracts", "payment-proofs", "sap-exports",
  "claim-vouchers", "user-signatures"
)

foreach ($bucket in $buckets) {
  $uri = "$($env:SUPABASE_URL.TrimEnd('/'))/storage/v1/bucket/$bucket/empty"
  try {
    Invoke-RestMethod -Method Post -Uri $uri -Headers $headers `
      -ContentType "application/json" -Body "{}" | Out-Null
    Write-Host "Emptied storage bucket: $bucket"
  }
  catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }
    Write-Host "Storage bucket not present: $bucket"
  }
}
