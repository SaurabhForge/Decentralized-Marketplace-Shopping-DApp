// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Marketplace {
    string public name;
    uint public productCount = 0;

    struct Product {
        uint id;
        string name;
        uint price;
        address payable owner;
        bool sold;
    }

    mapping(uint => Product) public products;

    event ProductListed(
        uint id,
        string name,
        uint price,
        address owner,
        bool sold
    );

    event ProductSold(
        uint id,
        string name,
        uint price,
        address owner,
        bool sold
    );

    constructor() {
        name = "Decentralized Marketplace";
    }

    // Function to add a product
    function addProduct(string memory _name, uint _price) public {
        require(bytes(_name).length > 0, "Product name cannot be empty");
        require(_price > 0, "Product price must be greater than zero");

        productCount ++;

        products[productCount] = Product(
            productCount,
            _name,
            _price,
            payable(msg.sender),
            false
        );

        emit ProductListed(
            productCount,
            _name,
            _price,
            msg.sender,
            false
        );
    }

    // Function to buy a product
    function buyProduct(uint _id) public payable {
        Product memory _product = products[_id];
        address payable _seller = _product.owner;

        require(_product.id > 0 && _product.id <= productCount, "Product does not exist");
        require(msg.value >= _product.price, "Not enough Ether to cover item price");
        require(!_product.sold, "Product already sold");
        require(_seller != msg.sender, "Seller cannot buy their own product");

        // Transfer ownership to the buyer
        _product.owner = payable(msg.sender);
        _product.sold = true;

        // Update the product mapping
        products[_id] = _product;

        // Pay the seller
        _seller.transfer(msg.value);

        // Emit sale event
        emit ProductSold(
            productCount,
            _product.name,
            _product.price,
            msg.sender,
            true
        );
    }

    // Function to get product count
    function getProductCount() public view returns (uint) {
        return productCount;
    }

    // Function to get a product by ID
    function getProduct(uint _id) public view returns (Product memory) {
        return products[_id];
    }
}
