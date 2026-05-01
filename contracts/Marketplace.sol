// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Marketplace {
    string public constant name = "Decentralized Marketplace";
    uint256 public productCount;

    bool private locked;

    error EmptyProductName();
    error InvalidProductPrice();
    error ProductDoesNotExist(uint256 id);
    error ProductAlreadySold(uint256 id);
    error SellerCannotBuyOwnProduct();
    error IncorrectPayment(uint256 expected, uint256 received);
    error SellerPaymentFailed();

    struct Product {
        uint256 id;
        string name;
        uint256 price;
        address payable owner;
        bool sold;
    }

    mapping(uint256 => Product) public products;

    event ProductListed(
        uint256 indexed id,
        string name,
        uint256 price,
        address indexed owner,
        bool sold
    );

    event ProductSold(
        uint256 indexed id,
        string name,
        uint256 price,
        address indexed owner,
        bool sold
    );

    modifier nonReentrant() {
        require(!locked, "ReentrancyGuard: reentrant call");
        locked = true;
        _;
        locked = false;
    }

    function addProduct(string calldata _name, uint256 _price) external {
        if (bytes(_name).length == 0) revert EmptyProductName();
        if (_price == 0) revert InvalidProductPrice();

        productCount++;

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

    function buyProduct(uint256 _id) external payable nonReentrant {
        Product storage product = products[_id];

        if (product.id == 0 || product.id > productCount) {
            revert ProductDoesNotExist(_id);
        }
        if (product.sold) revert ProductAlreadySold(_id);
        if (product.owner == msg.sender) revert SellerCannotBuyOwnProduct();
        if (msg.value != product.price) {
            revert IncorrectPayment(product.price, msg.value);
        }

        address payable seller = product.owner;

        product.owner = payable(msg.sender);
        product.sold = true;

        (bool success, ) = seller.call{value: msg.value}("");
        if (!success) revert SellerPaymentFailed();

        emit ProductSold(
            _id,
            product.name,
            product.price,
            msg.sender,
            true
        );
    }

    function getProductCount() external view returns (uint256) {
        return productCount;
    }

    function getProduct(uint256 _id) external view returns (Product memory) {
        if (products[_id].id == 0 || _id > productCount) {
            revert ProductDoesNotExist(_id);
        }
        return products[_id];
    }

    function getAvailableProducts() external view returns (Product[] memory) {
        uint256 availableCount;

        for (uint256 i = 1; i <= productCount; i++) {
            if (!products[i].sold) {
                availableCount++;
            }
        }

        Product[] memory availableProducts = new Product[](availableCount);
        uint256 index;

        for (uint256 i = 1; i <= productCount; i++) {
            if (!products[i].sold) {
                availableProducts[index] = products[i];
                index++;
            }
        }

        return availableProducts;
    }
}
