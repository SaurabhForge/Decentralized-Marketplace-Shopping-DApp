# Decentralized Marketplace Shopping DApp

BlockMart is a full-stack Web3 marketplace built with Solidity, Hardhat, React, Vite, Firebase, and Google Cloud Run. Users can list digital products, buy available products with ETH, track marketplace activity through Google services, and connect the frontend to a deployable GCP API.

## Features

- Solidity marketplace contract with validated listings, exact-payment purchases, reentrancy protection, indexed events, and available-product reads.
- React shopping interface with MetaMask wallet connection, responsive product cards, accessible form controls, and transaction status states.
- Firebase integration for Google sign-in, Analytics events, Firestore listing snapshots, and Storage metadata uploads.
- Google Cloud Run API with health/config endpoints, featured product data, secured CORS, Helmet headers, rate limiting, Joi request validation, and Firestore event persistence.
- Automated deployment helper that prints the generated Cloud Run API URL and writes it to `frontend/.env.gcp`.

## Project Structure

```text
contracts/          Solidity smart contracts
test/               Hardhat contract tests
scripts/            Deploy scripts for blockchain and GCP API
frontend/           React + Vite DApp
api/                Express API ready for Google Cloud Run
cloudbuild.yaml     Optional Cloud Build deployment pipeline
```

## Local Setup

```bash
npm install
cd frontend && npm install && cd ..
cd api && npm install && cd ..
```

Copy `.env.example` to `.env`, then fill in the values you need for Sepolia, Firebase, and GCP.

## Run Locally

Start the local blockchain:

```bash
npm run node
```

Deploy and seed the contract in a second terminal:

```bash
npm run deploy:local
```

Start the GCP-compatible API locally:

```bash
npm run api:dev
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Open the Vite URL, connect MetaMask to:

- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency: `ETH`

## Generate The GCP API URL

Make sure the Google Cloud SDK is authenticated and a project is selected:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Deploy the API to Cloud Run:

```powershell
npm run api:deploy:gcp -- -Region us-central1 -FrontendOrigin https://YOUR_FRONTEND_DOMAIN
```

The script prints the real URL, for example:

```text
Generated GCP Cloud Run API URL: https://blockmart-marketplace-api-xxxxx-uc.a.run.app
Frontend env value: VITE_GCP_API_URL=https://blockmart-marketplace-api-xxxxx-uc.a.run.app
```

It also creates `frontend/.env.gcp` with `VITE_GCP_API_URL` so the frontend can call the Cloud Run API.

## Deploy To Render

This repo includes a Render Blueprint at `render.yaml` for a complete hosted deployment:

- Backend API web service: `blockmart-marketplace-api-saurabhforge`
- Frontend static site: `blockmart-marketplace-frontend`

Expected Render URLs after the Blueprint is created:

```text
https://blockmart-marketplace-api-saurabhforge.onrender.com
https://blockmart-marketplace-frontend.onrender.com
```

Deploy steps:

1. Open Render Dashboard.
2. Create a new Blueprint from this GitHub repo.
3. Select the `main` branch and the root `render.yaml`.
4. Render will build both services and enable auto-deploys on future pushes.

The hosted storefront works with the Render API immediately. Wallet connection works in the browser through MetaMask. To enable live on-chain buying and listing on a public network, deploy `contracts/Marketplace.sol` to Sepolia and set this frontend environment variable in Render:

```text
VITE_MARKETPLACE_CONTRACT_ADDRESS=your_sepolia_contract_address
```

The Blueprint already sets Sepolia defaults:

```text
VITE_CHAIN_ID_HEX=0xaa36a7
VITE_CHAIN_NAME=Sepolia
VITE_RPC_URL=https://rpc.sepolia.org
```

## Firebase Environment

Add these values to `frontend/.env` or copy from `frontend/.env.example`:

```text
VITE_API_URL=https://blockmart-marketplace-api-saurabhforge.onrender.com
VITE_GCP_API_URL=https://blockmart-marketplace-api-xxxxx-uc.a.run.app
VITE_CHAIN_ID_HEX=0xaa36a7
VITE_CHAIN_NAME=Sepolia
VITE_RPC_URL=https://rpc.sepolia.org
VITE_MARKETPLACE_CONTRACT_ADDRESS=your_public_network_contract
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

## Verification

```bash
npm test
cd frontend && npm run lint && npm run build
cd ../api && npm audit
```

## License

MIT
