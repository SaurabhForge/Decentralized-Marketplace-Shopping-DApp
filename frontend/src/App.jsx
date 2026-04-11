import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import contractAddress from './utils/contract-address.json';
import MarketplaceArtifact from './utils/Marketplace.json';

function App() {
  const [account, setAccount] = useState(null);
  const [marketplace, setMarketplace] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isBuying, setIsBuying] = useState(null); // Track the ID being bought

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  const checkIfWalletIsConnected = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const account = accounts[0];
          setAccount(account);
          initContract();
        } else {
          setLoading(false);
        }
      } else {
        console.log("No ethereum object found");
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) return alert("Please install MetaMask.");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      initContract();
    } catch (error) {
      console.error(error);
    }
  };

  const initContract = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress.Marketplace,
        MarketplaceArtifact.abi,
        signer
      );
      setMarketplace(contract);
      await loadProducts(contract);
    } catch (error) {
      console.error("Error init contract", error);
    }
  };

  const loadProducts = async (contract) => {
    try {
      setLoading(true);
      const productCount = await contract.getProductCount();
      const items = [];
      for (let i = 1; i <= productCount; i++) {
        const product = await contract.getProduct(i);
        items.push({
          id: Number(product.id),
          name: product.name,
          price: ethers.formatEther(product.price),
          owner: product.owner,
          sold: product.sold
        });
      }
      setProducts(items);
    } catch (error) {
      console.error("Error loading products", error);
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (e) => {
    e.preventDefault();
    if (!productName || !productPrice || !marketplace) return;
    
    setIsAdding(true);
    try {
      const priceInWei = ethers.parseEther(productPrice.toString());
      const tx = await marketplace.addProduct(productName, priceInWei);
      await tx.wait();
      
      // Reset form and reload
      setProductName('');
      setProductPrice('');
      await loadProducts(marketplace);
    } catch (error) {
      console.error("Error adding product", error);
      alert("Failed to add product. Check console.");
    } finally {
      setIsAdding(false);
    }
  };

  const buyProduct = async (id, priceStr) => {
    if (!marketplace) return;
    
    setIsBuying(id);
    try {
      const priceInWei = ethers.parseEther(priceStr);
      const tx = await marketplace.buyProduct(id, { value: priceInWei });
      await tx.wait();
      await loadProducts(marketplace);
    } catch (error) {
      console.error("Error buying product", error);
      alert("Failed to buy. Remember you can't buy your own product!");
    } finally {
      setIsBuying(null);
    }
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo">BlockMart</div>
        {account ? (
          <button className="btn btn-connect">
            {account.slice(0, 6)}...{account.slice(-4)}
          </button>
        ) : (
          <button className="btn btn-connect" onClick={connectWallet}>
            Connect Wallet
          </button>
        )}
      </header>

      {account ? (
        <main>
          <div className="premium-panel">
            <h2>Add New Product</h2>
            <form onSubmit={addProduct} className="form-group">
              <input 
                type="text" 
                placeholder="Product Name (e.g., Rare NFT Art)" 
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                disabled={isAdding}
              />
              <input 
                type="number" 
                step="0.001"
                placeholder="Price in ETH" 
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                disabled={isAdding}
              />
              <button type="submit" className="btn" disabled={isAdding || !productName || !productPrice}>
                {isAdding ? "Listling..." : "List Product"}
              </button>
            </form>
          </div>

          <h2 className="catalog-title">Marketplace Catalog</h2>
          {loading ? (
            <div className="loader">Loading products...</div>
          ) : (
            <div className="grid">
              {products.map((product) => (
                <div key={product.id} className="product-card">
                  <div className="product-name">{product.name}</div>
                  <div className="product-price">{product.price} ETH</div>
                  <div className="product-owner">
                    Owner: {product.owner.slice(0, 6)}...{product.owner.slice(-4)}
                  </div>
                  
                  {product.sold ? (
                    <div className="sold-badge">Sold Out</div>
                  ) : (
                    <button 
                      className="btn" 
                      style={{ width: '100%' }}
                      onClick={() => buyProduct(product.id, product.price.toString())}
                      disabled={isBuying === product.id || product.owner.toLowerCase() === account.toLowerCase()}
                    >
                      {isBuying === product.id ? "Purchasing..." : "Buy Now"}
                    </button>
                  )}
                </div>
              ))}
              {products.length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>No products listed yet. Be the first!</p>
              )}
            </div>
          )}
        </main>
      ) : (
        <div className="premium-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h2>Welcome to BlockMart</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            A decentralized marketplace for buying and selling digital goods.
            Connect your MetaMask wallet to get started.
          </p>
          <button className="btn" style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }} onClick={connectWallet}>
            Connect MetaMask to Browse
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
