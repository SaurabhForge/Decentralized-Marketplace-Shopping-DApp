const hre = require("hardhat");
const fs = require('fs');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy();

  await marketplace.waitForDeployment();

  const address = await marketplace.getAddress();
  console.log("Marketplace deployed to:", address);

  // Save the contract address and ABI to frontend for easy access
  saveFrontendFiles(address, Marketplace.interface.formatJson());
}

function saveFrontendFiles(contractAddress, contractAbi) {
  const contractsDir = __dirname + "/../frontend/src/utils";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  // Write address
  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify({ Marketplace: contractAddress }, undefined, 2)
  );

  // Write ABI
  fs.writeFileSync(
    contractsDir + "/Marketplace.json",
    contractAbi
  );
  console.log("Frontend contract files updated!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
