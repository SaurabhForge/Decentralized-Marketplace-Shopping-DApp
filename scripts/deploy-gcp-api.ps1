param(
  [string]$ServiceName = "blockmart-marketplace-api",
  [string]$Region = "us-central1",
  [string]$FrontendOrigin = "http://localhost:5173",
  [string]$ContractAddress = "",
  [string]$RpcUrl = "",
  [string]$ChainId = "31337"
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

& $Gcloud services enable run.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com --project $ProjectId

function ConvertTo-YamlSingleQuotedValue {
  param([string]$Value)
  return "'" + ($Value -replace "'", "''") + "'"
}

$EnvVars = [ordered]@{
  GOOGLE_CLOUD_PROJECT = $ProjectId
  FRONTEND_ORIGIN = $FrontendOrigin
  CHAIN_ID = $ChainId
}

if ($ContractAddress) {
  $EnvVars.MARKETPLACE_CONTRACT_ADDRESS = $ContractAddress
}

if ($RpcUrl) {
  $EnvVars.RPC_URL = $RpcUrl
}

$EnvVarsFile = New-TemporaryFile
$EnvVars.GetEnumerator() | ForEach-Object {
  "$($_.Key): $(ConvertTo-YamlSingleQuotedValue $_.Value)"
} | Set-Content -Path $EnvVarsFile -Encoding utf8

try {
  & $Gcloud run deploy $ServiceName `
    --source api `
    --region $Region `
    --allow-unauthenticated `
    --env-vars-file $EnvVarsFile `
    --project $ProjectId
}
finally {
  Remove-Item -LiteralPath $EnvVarsFile -Force -ErrorAction SilentlyContinue
}

$ApiUrl = (& $Gcloud run services describe $ServiceName --region $Region --project $ProjectId --format "value(status.url)").Trim()

Write-Host ""
Write-Host "Generated GCP Cloud Run API URL: $ApiUrl"
Write-Host "Frontend env value: VITE_GCP_API_URL=$ApiUrl"

Set-Content -Path "frontend/.env.gcp" -Value "VITE_GCP_API_URL=$ApiUrl"
