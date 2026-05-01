const { expect } = require("chai");
const { ethers } = require("hardhat");

const tokens = (n) => {
  return ethers.parseUnits(n.toString(), "ether");
};

describe("Marketplace", function () {
  let marketplace;
  let deployer, seller, buyer, secondBuyer;

  beforeEach(async () => {
    [deployer, seller, buyer, secondBuyer] = await ethers.getSigners();

    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy();
    await marketplace.waitForDeployment();
  });

  describe("Deployment", () => {
    it("tracks the marketplace name", async () => {
      expect(await marketplace.name()).to.equal("Decentralized Marketplace");
    });
  });

  describe("Creating products", () => {
    let transaction;

    beforeEach(async () => {
      transaction = await marketplace.connect(seller).addProduct("iPhone", tokens(1));
      await transaction.wait();
    });

    it("creates products", async () => {
      const productCount = await marketplace.productCount();
      expect(productCount).to.equal(1);

      const product = await marketplace.products(productCount);
      expect(product.id).to.equal(1);
      expect(product.name).to.equal("iPhone");
      expect(product.price).to.equal(tokens(1));
      expect(product.owner).to.equal(seller.address);
      expect(product.sold).to.equal(false);
    });

    it("emits ProductListed event", async () => {
      await expect(transaction).to.emit(marketplace, "ProductListed")
        .withArgs(1, "iPhone", tokens(1), seller.address, false);
    });

    it("rejects invalid product details", async () => {
      await expect(marketplace.connect(seller).addProduct("", tokens(1)))
        .to.be.revertedWithCustomError(marketplace, "EmptyProductName");

      await expect(marketplace.connect(seller).addProduct("Free Item", 0))
        .to.be.revertedWithCustomError(marketplace, "InvalidProductPrice");
    });
  });

  describe("Buying products", () => {
    let transaction;

    beforeEach(async () => {
      transaction = await marketplace.connect(seller).addProduct("iPhone", tokens(1));
      await transaction.wait();
    });

    it("sells products and pays seller", async () => {
      const sellerInitialBalance = await ethers.provider.getBalance(seller.address);

      transaction = await marketplace.connect(buyer).buyProduct(1, { value: tokens(1) });
      await transaction.wait();

      const product = await marketplace.products(1);
      expect(product.id).to.equal(1);
      expect(product.name).to.equal("iPhone");
      expect(product.price).to.equal(tokens(1));
      expect(product.owner).to.equal(buyer.address);
      expect(product.sold).to.equal(true);

      const sellerFinalBalance = await ethers.provider.getBalance(seller.address);
      expect(sellerFinalBalance - sellerInitialBalance).to.equal(tokens(1));
    });

    it("emits ProductSold event with the purchased product id", async () => {
      await marketplace.connect(seller).addProduct("Laptop", tokens(2));

      transaction = await marketplace.connect(buyer).buyProduct(2, { value: tokens(2) });

      await expect(transaction).to.emit(marketplace, "ProductSold")
        .withArgs(2, "Laptop", tokens(2), buyer.address, true);
    });

    it("rejects invalid purchase attempts", async () => {
      await expect(marketplace.connect(buyer).buyProduct(999, { value: tokens(1) }))
        .to.be.revertedWithCustomError(marketplace, "ProductDoesNotExist")
        .withArgs(999);

      await expect(marketplace.connect(seller).buyProduct(1, { value: tokens(1) }))
        .to.be.revertedWithCustomError(marketplace, "SellerCannotBuyOwnProduct");

      await expect(marketplace.connect(buyer).buyProduct(1, { value: tokens(0.5) }))
        .to.be.revertedWithCustomError(marketplace, "IncorrectPayment")
        .withArgs(tokens(1), tokens(0.5));

      await expect(marketplace.connect(buyer).buyProduct(1, { value: tokens(2) }))
        .to.be.revertedWithCustomError(marketplace, "IncorrectPayment")
        .withArgs(tokens(1), tokens(2));
    });

    it("prevents buying an item twice", async () => {
      await marketplace.connect(buyer).buyProduct(1, { value: tokens(1) });

      await expect(marketplace.connect(secondBuyer).buyProduct(1, { value: tokens(1) }))
        .to.be.revertedWithCustomError(marketplace, "ProductAlreadySold")
        .withArgs(1);
    });

    it("returns only available products", async () => {
      await marketplace.connect(seller).addProduct("Laptop", tokens(2));
      await marketplace.connect(buyer).buyProduct(1, { value: tokens(1) });

      const availableProducts = await marketplace.getAvailableProducts();

      expect(availableProducts).to.have.lengthOf(1);
      expect(availableProducts[0].id).to.equal(2);
      expect(availableProducts[0].name).to.equal("Laptop");
    });
  });
});
