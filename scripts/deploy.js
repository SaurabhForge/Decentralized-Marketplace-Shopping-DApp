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

  // Seed the marketplace with initial demo items so it isn't empty
  console.log("Seeding marketplace with items...");
  
  const tx1 = await marketplace.addProduct("Genesis NFT", hre.ethers.parseEther("0.85"));
  await tx1.wait();
  
  const tx2 = await marketplace.addProduct("Cyber Keyboard Pro", hre.ethers.parseEther("0.12"));
  await tx2.wait();
  
  const tx3 = await marketplace.addProduct("Quantum SmartWatch", hre.ethers.parseEther("0.45"));
  await tx3.wait();
  
  const tx4 = await marketplace.addProduct("Rare Pixel Dragon", hre.ethers.parseEther("1.20"));
  await tx4.wait();
  
  const tx5 = await marketplace.addProduct("Sound Forge Headset", hre.ethers.parseEther("0.08"));
  await tx5.wait();

  console.log("Marketplace successfully seeded with 5 items.");

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
