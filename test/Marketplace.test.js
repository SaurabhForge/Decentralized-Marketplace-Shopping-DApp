const { expect } = require("chai");
const { ethers } = require("hardhat");

const tokens = (n) => {
  return ethers.parseUnits(n.toString(), 'ether')
}

describe("Marketplace", function () {
  let marketplace
  let deployer, seller, buyer

  beforeEach(async () => {
    // Setup accounts
    [deployer, seller, buyer] = await ethers.getSigners()

    // Deploy contract
    const Marketplace = await ethers.getContractFactory("Marketplace")
    marketplace = await Marketplace.deploy()
    await marketplace.waitForDeployment()
  })

  describe('Deployment', () => {
    it('Tracks the name', async () => {
      expect(await marketplace.name()).to.equal("Decentralized Marketplace")
    })
  })

  describe('Creating products', () => {
    let transaction;
    beforeEach(async () => {
      transaction = await marketplace.connect(seller).addProduct("iPhone", tokens(1))
      await transaction.wait()
    })

    it('Creates products', async () => {
      const productCount = await marketplace.productCount()
      expect(productCount).to.equal(1)
      
      const product = await marketplace.products(productCount)
      expect(product.id).to.equal(1)
      expect(product.name).to.equal("iPhone")
      expect(product.price).to.equal(tokens(1))
      expect(product.owner).to.equal(seller.address)
      expect(product.sold).to.equal(false)
    })

    it('Emits ProductListed event', async () => {
      await expect(transaction).to.emit(marketplace, "ProductListed")
        .withArgs(1, "iPhone", tokens(1), seller.address, false)
    })
  })

  describe('Buying products', () => {
    let transaction
    beforeEach(async () => {
      transaction = await marketplace.connect(seller).addProduct("iPhone", tokens(1))
      await transaction.wait()
    })

    it('Sells products and pays seller', async () => {
      const sellerInitialBalance = await ethers.provider.getBalance(seller.address)

      // Buyer buys product
      transaction = await marketplace.connect(buyer).buyProduct(1, { value: tokens(1) })
      await transaction.wait()

      // Verify product ownership change and sold status
      const product = await marketplace.products(1)
      expect(product.id).to.equal(1)
      expect(product.name).to.equal("iPhone")
      expect(product.price).to.equal(tokens(1))
      expect(product.owner).to.equal(buyer.address)
      expect(product.sold).to.equal(true)

      // Verify seller received funds
      const sellerFinalBalance = await ethers.provider.getBalance(seller.address)
      expect(sellerFinalBalance).to.be.greaterThan(sellerInitialBalance)
    })

    it('Emits ProductSold event', async () => {
       transaction = await marketplace.connect(buyer).buyProduct(1, { value: tokens(1) })
       await expect(transaction).to.emit(marketplace, "ProductSold")
         .withArgs(1, "iPhone", tokens(1), buyer.address, true)
    })
  })
});
