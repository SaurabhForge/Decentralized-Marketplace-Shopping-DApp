# Decentralized Marketplace (Shopping DApp)

A full-stack Web3 application built with Solidity, Hardhat, React, and Vite. This application allows users to list products and purchase them using cryptocurrency (Ethereum). It features a modern, premium UI with a glassmorphism design and dark mode aesthetic.

## Features

- **Decentralized Backend**: Smart contracts written in Solidity and deployed to the blockchain.
- **Wallet Integration**: Connect your Web3 wallet (e.g., MetaMask) to interact with the application.
- **Product Management**: List new products with a name, image, and price, or purchase existing products.
- **Beautiful UI**: Built with React and Vanilla CSS, featuring a responsive and dynamic design using glassmorphism styling.

## Prerequisites

Before running the project locally, ensure you have the following installed:

- Node.js (v16 or higher)
- npm or yarn
- MetaMask (browser extension) for interacting with the DApp locally

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SaurabhForge/Decentralized-Marketplace-Shopping-DApp.git
   cd Decentralized-Marketplace-Shopping-DApp
   ```

2. **Install root dependencies (Hardhat & Backend):**
   ```bash
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

## Running on Localhost

To run the application locally, you'll need to start the local blockchain network, deploy the contract, and spin up the frontend server.

### 1. Start Local Hardhat Network

In the root directory of the project, run:
```bash
npx hardhat node
```
This command will start a local Ethereum network on `http://127.0.0.1:8545` and provide you with a list of test accounts and their private keys.

### 2. Deploy Smart Contract

Open a **new terminal tab/window** in the root directory and deploy the `Marketplace` smart contract to your local network:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
*Note: The script automatically copies the smart contract ABI and deployment address to `frontend/src/utils/`, so you don't need to manually configure them.*

### 3. Setup MetaMask

1. Open your MetaMask extension.
2. Go to Settings > Networks > Add a network manually.
3. Configure a local network:
   - **Network Name**: Localhost 8545
   - **New RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: 31337
   - **Currency Symbol**: ETH
4. Import one of the test accounts by copying a private key from the terminal running the `npx hardhat node` command and pasting it into the MetaMask "Import Account" dialogue.

### 4. Start the Frontend Development Server

Navigate to the `frontend` folder and start up Vite:
```bash
cd frontend
npm run dev
```
The application's interface will be accessible at `http://localhost:5173/` (or whichever port Vite assigns).

Visit the URL in your browser, connect your MetaMask wallet (ensuring you are on the `Localhost 8545` network), and start browsing or listing products!

## Technologies Used

- [Solidity](https://soliditylang.org/)
- [Hardhat](https://hardhat.org/)
- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Ethers.js](https://docs.ethers.org/v6/)

## License
MIT License
