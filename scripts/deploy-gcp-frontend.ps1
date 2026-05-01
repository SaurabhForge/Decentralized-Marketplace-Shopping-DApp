param(
  [string]$ServiceName = "blockmart-marketplace-frontend",
  [string]$Region = "us-central1",
  [string]$ApiUrl = "https://blockmart-marketplace-api-26kdhhc42a-uc.a.run.app"
)

$ErrorActionPreference = "Stop"

$Gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $Gcloud)) {
  $Gcloud = "gcloud"
}

$ProjectId = (& $Gcloud config get-value project 2>$null).Trim()
if (-not $ProjectId) {
  throw "No active GCP project is configured. Run: gcloud config set project YOUR_PROJECT_ID"
}

Set-Content -Path "frontend/.env.production" -Value "VITE_GCP_API_URL=$ApiUrl"

& $Gcloud services enable run.googleapis.com cloudbuild.googleapis.com --project $ProjectId

& $Gcloud run deploy $ServiceName `
  --source frontend `
  --region $Region `
  --allow-unauthenticated `
  --project $ProjectId

$FrontendUrl = (& $Gcloud run services describe $ServiceName --region $Region --project $ProjectId --format "value(status.url)").Trim()

Write-Host ""
Write-Host "Generated GCP frontend URL: $FrontendUrl"
Write-Host "Frontend uses API URL: $ApiUrl"
