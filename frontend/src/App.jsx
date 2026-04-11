import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import contractAddress from './utils/contract-address.json';
import MarketplaceArtifact from './utils/Marketplace.json';

function App() {
  const [account, setAccount] = useState(null);
  const [marketplace, setMarketplace] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isBuying, setIsBuying] = useState(null);

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
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      setError('');
      if (!window.ethereum) {
        setError("MetaMask not detected. Please install the MetaMask extension to use BlockMart.");
        return;
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      initContract();
    } catch (error) {
      console.error(error);
      setError("Failed to connect wallet. Please try again.");
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
        <div className="header-content">
          <div className="logo-section">
            <div className="logo">
              <span className="logo-icon">B</span>
              BlockMart
            </div>
            <div className="creator-badge">
              <img 
                src="https://github.com/SaurabhForge.png" 
                alt="Saurabh Kumar" 
                className="creator-avatar"
                onError={(e) => {e.target.style.display='none'}}
              />
              <span>By Saurabh Kumar</span>
            </div>
          </div>
          
          <div className="header-actions">
            {account ? (
              <button className="btn btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px'}}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                {account.slice(0, 6)}...{account.slice(-4)}
              </button>
            ) : (
              <button className="btn" onClick={connectWallet}>
                Sign In / Connect
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="alert-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div>
            {error} <br/>
            Don't have a wallet? <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">Download MetaMask</a>
          </div>
        </div>
      )}

      <main>
        {!account && (
          <div className="hero">
            <h1>The New Standard in Digital Commerce</h1>
            <p>Buy and sell premium digital assets securely on the blockchain. Connect your wallet to access the marketplace.</p>
            <button className="btn" style={{ fontSize: '1.125rem', padding: '0.875rem 2rem' }} onClick={connectWallet}>
              Connect Wallet to Explore
            </button>
          </div>
        )}

        {account && (
          <>
            <div className="seller-panel">
              <div className="seller-panel-header">
                <h2>List a New Item</h2>
              </div>
              <form onSubmit={addProduct} className="form-group">
                <div className="input-wrapper">
                  <label htmlFor="productName">Product Name</label>
                  <input 
                    id="productName"
                    type="text" 
                    placeholder="e.g. Vintage Typewriter" 
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    disabled={isAdding}
                  />
                </div>
                <div className="input-wrapper">
                  <label htmlFor="productPrice">Listing Price (ETH)</label>
                  <input 
                    id="productPrice"
                    type="number" 
                    step="0.001"
                    placeholder="0.05" 
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    disabled={isAdding}
                  />
                </div>
                <div className="input-wrapper" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
                  <button type="submit" className="btn" disabled={isAdding || !productName || !productPrice}>
                    {isAdding ? "Listing..." : "Post Item"}
                  </button>
                </div>
              </form>
            </div>

            <div className="section-header">
              <h2 className="section-title">Fresh Listings</h2>
            </div>

            {loading ? (
              <div className="loader">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                Syncing with network...
              </div>
            ) : (
              <div className="grid">
                {products.map((product) => (
                  <div key={product.id} className="product-card">
                    <div className="product-image-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    </div>
                    
                    <div className="product-details">
                      <div className="product-name">{product.name}</div>
                      <div className="product-owner-tag">Seller: {product.owner.slice(0, 6)}...{product.owner.slice(-4)}</div>
                      
                      <div className="product-price-row">
                        <span className="price-label">Price</span>
                        <span className="product-price">{product.price} ETH</span>
                      </div>
                    </div>
                    
                    <div className="card-actions">
                      {product.sold ? (
                        <div className="sold-badge">Out of Stock</div>
                      ) : (
                        <button 
                          className="btn" 
                          style={{ width: '100%', padding: '0.75rem' }}
                          onClick={() => buyProduct(product.id, product.price.toString())}
                          disabled={isBuying === product.id || product.owner.toLowerCase() === account.toLowerCase()}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px'}}>
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                          </svg>
                          {isBuying === product.id ? "Processing..." : "Add to Cart"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)', background: 'white', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 1rem' }}>
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <p>No inventory found. Be the first to list an item.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer>
        Created with ❤️ by <strong>Saurabh Kumar</strong> &copy; {new Date().getFullYear()} BlockMart
      </footer>
    </div>
  );
}

export default App;
