import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import contractAddress from './utils/contract-address.json';
import MarketplaceArtifact from './utils/Marketplace.json';
import { fetchCloudConfig, fetchFeaturedProducts, getCloudApiUrl, publishAnalyticsEvent } from './services/cloudApi';
import {
  isGoogleConfigured,
  saveListingSnapshot,
  signInWithGoogle,
  trackMarketplaceEvent,
  uploadListingMetadata,
} from './services/googleServices';

const catalogFallback = [
  {
    id: 'local-1',
    name: 'Genesis NFT',
    category: 'Collectibles',
    price: '0.85',
    owner: 'Verified seller',
    source: 'Cloud catalog',
  },
  {
    id: 'local-2',
    name: 'Cyber Keyboard Pro',
    category: 'Electronics',
    price: '0.12',
    owner: 'Creator store',
    source: 'Cloud catalog',
  },
  {
    id: 'local-3',
    name: 'Quantum SmartWatch',
    category: 'Wearables',
    price: '0.45',
    owner: 'Device studio',
    source: 'Cloud catalog',
  },
];

const categoryOptions = ['All', 'Collectibles', 'Electronics', 'Wearables'];
const configuredContractAddress = import.meta.env.VITE_MARKETPLACE_CONTRACT_ADDRESS || contractAddress.Marketplace;
const walletNetwork = {
  chainId: import.meta.env.VITE_CHAIN_ID_HEX || '0x7a69',
  chainName: import.meta.env.VITE_CHAIN_NAME || 'Hardhat Localhost',
  rpcUrls: [import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545/'],
  nativeCurrency: {
    name: import.meta.env.VITE_NATIVE_CURRENCY_NAME || 'ETH',
    symbol: import.meta.env.VITE_NATIVE_CURRENCY_SYMBOL || 'ETH',
    decimals: 18,
  },
};
const hasPublicContract = Boolean(import.meta.env.VITE_MARKETPLACE_CONTRACT_ADDRESS);
const shouldUseOnChain = !import.meta.env.PROD || hasPublicContract;

const productImages = {
  art: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=900&q=80',
  keyboard: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
  watch: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  headset: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
};

const getImageForProduct = (name) => {
  if (name.includes('NFT') || name.includes('Dragon')) return productImages.art;
  if (name.includes('Keyboard')) return productImages.keyboard;
  if (name.includes('Headset')) return productImages.headset;
  if (name.includes('Watch')) return productImages.watch;
  return productImages.keyboard;
};

const getProductMeta = (name) => {
  if (name.includes('NFT') || name.includes('Dragon')) {
    return { category: 'Collectibles', condition: 'Digital original', delivery: 'Wallet transfer', rating: '4.9' };
  }

  if (name.includes('Keyboard') || name.includes('Headset')) {
    return { category: 'Electronics', condition: 'New', delivery: 'Tracked shipping', rating: '4.7' };
  }

  if (name.includes('Watch')) {
    return { category: 'Wearables', condition: 'New', delivery: '2 day dispatch', rating: '4.8' };
  }

  return { category: 'Marketplace', condition: 'Listed today', delivery: 'Seller arranged', rating: '4.6' };
};

const shortAddress = (value) => {
  if (!value || !value.startsWith('0x')) return value || 'Unknown seller';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const normalizeCategory = (category) => {
  if (category === 'Digital Collectible') return 'Collectibles';
  if (category === 'Hardware') return 'Electronics';
  if (category === 'Wearable') return 'Wearables';
  return category;
};

function App() {
  const [account, setAccount] = useState(null);
  const [marketplace, setMarketplace] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [googleUser, setGoogleUser] = useState(null);
  const [cloudApiReady, setCloudApiReady] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isBuying, setIsBuying] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    checkIfWalletIsConnected();
    hydrateCloudServices();
  }, []);

  const storefrontProducts = useMemo(() => {
    const cloudProducts = featuredProducts.length > 0
      ? featuredProducts.map((product) => ({
        id: product.id,
        name: product.name,
        category: normalizeCategory(product.category),
        price: product.priceEth,
        owner: 'BlockMart verified',
        source: 'GCP curated',
      }))
      : catalogFallback;

    return shouldUseOnChain && products.length > 0 ? products : cloudProducts;
  }, [featuredProducts, products]);

  const visibleProducts = useMemo(() => storefrontProducts.filter((product) => {
    const meta = getProductMeta(product.name);
    const category = normalizeCategory(product.category || meta.category);
    const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  }), [searchTerm, selectedCategory, storefrontProducts]);

  const activeCount = storefrontProducts.filter((product) => !product.sold).length;
  const totalValue = storefrontProducts
    .filter((product) => !product.sold)
    .reduce((sum, product) => sum + Number(product.price || 0), 0)
    .toFixed(2);

  const hydrateCloudServices = async () => {
    try {
      const [cloudConfig, featured] = await Promise.all([
        fetchCloudConfig(),
        fetchFeaturedProducts(),
      ]);

      setCloudApiReady(Boolean(cloudConfig));
      setFeaturedProducts(featured?.products || []);
    } catch (error) {
      console.warn('Cloud API is not available yet', error);
      setCloudApiReady(false);
    }
  };

  const checkIfWalletIsConnected = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          if (shouldUseOnChain) {
            await checkAndSwitchNetwork();
          }
          setAccount(accounts[0]);
          if (shouldUseOnChain) {
            initContract();
          } else {
            setLoading(false);
          }
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

  const checkAndSwitchNetwork = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: walletNetwork.chainId }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: walletNetwork.chainId,
                chainName: walletNetwork.chainName,
                rpcUrls: walletNetwork.rpcUrls,
                nativeCurrency: walletNetwork.nativeCurrency,
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add network', addError);
        }
      }
    }
  };

  const connectWallet = async () => {
    try {
      setError('');
      if (!window.ethereum) {
        setError('MetaMask is not available in this browser. Install it to buy or list products.');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (shouldUseOnChain) {
        await checkAndSwitchNetwork();
      }
      setAccount(accounts[0]);
      if (shouldUseOnChain) {
        initContract();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setError('Wallet connection was not completed. Open MetaMask and try again.');
    }
  };

  const connectGoogleAccount = async () => {
    try {
      setError('');
      const user = await signInWithGoogle();
      setGoogleUser(user);
      await trackMarketplaceEvent('google_sign_in', {
        provider: 'google',
      });
    } catch (error) {
      console.error(error);
      setError('Google sign-in is not configured yet. Check your Firebase environment variables.');
    }
  };

  const initContract = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        configuredContractAddress,
        MarketplaceArtifact,
        signer,
      );

      setMarketplace(contract);
      await loadProducts(contract);
    } catch (error) {
      console.error('Error init contract', error);
      setError('The configured blockchain contract is not reachable. You can still browse the hosted catalog.');
      setLoading(false);
    }
  };

  const loadProducts = async (contract) => {
    try {
      setLoading(true);
      const productCount = await contract.getProductCount();
      const count = Number(productCount);
      const items = [];

      for (let i = 1; i <= count; i++) {
        const product = await contract.getProduct(i);
        items.push({
          id: Number(product.id),
          name: product.name,
          price: ethers.formatEther(product.price),
          owner: product.owner,
          sold: product.sold,
          source: 'On-chain',
        });
      }

      setProducts(items);
    } catch (error) {
      console.error('Error loading products', error);
      setError('The configured blockchain contract is not reachable. You can still browse the hosted catalog.');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (event) => {
    event.preventDefault();
    if (!productName || !productPrice || !marketplace) return;

    setIsAdding(true);
    try {
      const priceInWei = ethers.parseEther(productPrice.toString());
      const tx = await marketplace.addProduct(productName, priceInWei);
      const receipt = await tx.wait();
      const listing = {
        id: Number(await marketplace.getProductCount()),
        name: productName,
        priceEth: productPrice,
        seller: account,
        transactionHash: receipt.hash,
      };

      await Promise.allSettled([
        saveListingSnapshot(listing),
        uploadListingMetadata(listing),
        publishAnalyticsEvent({
          type: 'product_listed',
          account,
          productId: listing.id,
          transactionHash: receipt.hash,
        }),
        trackMarketplaceEvent('product_listed', {
          product_id: listing.id,
          price_eth: productPrice,
        }),
      ]);

      setProductName('');
      setProductPrice('');
      await loadProducts(marketplace);
    } catch (error) {
      console.error('Error adding product', error);
      alert('The listing was not created. Check the wallet notification and try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const buyProduct = async (id, priceStr) => {
    if (!marketplace) {
      await connectWallet();
      return;
    }

    setIsBuying(id);
    try {
      const priceInWei = ethers.parseEther(priceStr);
      const tx = await marketplace.buyProduct(id, { value: priceInWei });
      const receipt = await tx.wait();

      await Promise.allSettled([
        publishAnalyticsEvent({
          type: 'product_purchased',
          account,
          productId: id,
          priceEth: priceStr,
          transactionHash: receipt.hash,
        }),
        trackMarketplaceEvent('product_purchased', {
          product_id: id,
          price_eth: priceStr,
        }),
      ]);

      await loadProducts(marketplace);
    } catch (error) {
      console.error('Error buying product', error);
      alert('The purchase was not completed. Check the wallet notification and seller ownership.');
    } finally {
      setIsBuying(null);
    }
  };

  const renderProductCard = (product) => {
    const meta = getProductMeta(product.name);
    const category = product.category || meta.category;
    const isOnChain = product.source === 'On-chain';
    const isOwner = account && product.owner?.toLowerCase?.() === account.toLowerCase();

    return (
      <article key={product.id} className="product-card">
        <div className="product-media">
          <img src={getImageForProduct(product.name)} alt={product.name} loading="lazy" />
          <span className="product-badge">{isOnChain ? 'On-chain' : category}</span>
        </div>
        <div className="product-body">
          <div className="product-kicker">
            <span>{category}</span>
            <span>{meta.rating} rating</span>
          </div>
          <h3>{product.name}</h3>
          <div className="seller-line">
            <span>Seller</span>
            <strong>{shortAddress(product.owner)}</strong>
          </div>
          <div className="product-meta">
            <span>{meta.condition}</span>
            <span>{meta.delivery}</span>
          </div>
        </div>
        <div className="product-footer">
          <div>
            <span className="price-label">Price</span>
            <strong className="product-price">{product.price} ETH</strong>
          </div>
          {product.sold ? (
            <span className="sold-pill">Sold</span>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => (isOnChain ? buyProduct(product.id, product.price.toString()) : connectWallet())}
              disabled={isBuying === product.id || isOwner || (!isOnChain && Boolean(account))}
              aria-label={`${isOnChain ? 'Buy' : account ? 'Wallet connected for' : 'Connect wallet for'} ${product.name}`}
            >
              {isBuying === product.id ? 'Processing' : isOnChain ? 'Buy' : account ? 'Connected' : 'Connect'}
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="app-container">
      <header className="site-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-mark">B</div>
            <div>
              <div className="brand-name">BlockMart</div>
              <span className="brand-subtitle">Verified Web3 marketplace</span>
            </div>
          </div>

          <label className="search-box" htmlFor="catalogSearch">
            <span>Search</span>
            <input
              id="catalogSearch"
              type="search"
              placeholder="Search products"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <div className="header-actions">
            <span className={`status-chip ${cloudApiReady ? 'online' : ''}`}>
              {cloudApiReady ? 'API online' : getCloudApiUrl() ? 'API pending' : 'Local mode'}
            </span>
            {googleUser && (
              <span className="status-chip" title={googleUser.email || googleUser.displayName}>
                {googleUser.displayName || googleUser.email}
              </span>
            )}
            {account ? (
              <button className="btn btn-secondary" aria-label="Connected wallet address">
                {shortAddress(account)}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={connectWallet} aria-label="Connect wallet">
                Connect wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Live commerce, blockchain settlement</span>
            <h1>Shop verified digital goods with transparent ownership.</h1>
            <p>
              Browse curated products, connect your wallet when you are ready, and list inventory with
              transaction history backed by Ethereum and Google Cloud services.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={connectWallet}>
                {account ? 'Wallet connected' : 'Connect wallet'}
              </button>
              {isGoogleConfigured && (
                <button className="btn btn-secondary" onClick={connectGoogleAccount}>
                  Sign in with Google
                </button>
              )}
            </div>
          </div>
          <div className="market-summary" aria-label="Marketplace summary">
            <div>
              <span>Active listings</span>
              <strong>{activeCount}</strong>
            </div>
            <div>
              <span>Catalog value</span>
              <strong>{totalValue} ETH</strong>
            </div>
            <div>
              <span>Contract</span>
              <strong>{shortAddress(configuredContractAddress)}</strong>
            </div>
          </div>
        </section>

        {error && (
          <div className="alert-error" role="alert">
            <strong>Connection notice</strong>
            <span>{error}</span>
            <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">Get MetaMask</a>
          </div>
        )}

        {account && (
          <section className="seller-panel">
            <div>
              <span className="eyebrow">Seller tools</span>
              <h2>Create a listing</h2>
            </div>
            <form onSubmit={addProduct} className="listing-form">
              <label htmlFor="productName">
                Product name
                <input
                  id="productName"
                  type="text"
                  placeholder="Vintage Typewriter"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  disabled={isAdding}
                  maxLength="80"
                  required
                />
              </label>
              <label htmlFor="productPrice">
                Price in ETH
                <input
                  id="productPrice"
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="0.05"
                  value={productPrice}
                  onChange={(event) => setProductPrice(event.target.value)}
                  disabled={isAdding}
                  required
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={isAdding || !productName || !productPrice}>
                {isAdding ? 'Publishing' : 'Post listing'}
              </button>
            </form>
          </section>
        )}

        <section className="catalog-section">
          <div className="section-header">
            <div>
              <span className="eyebrow">{account ? 'On-chain inventory' : 'Hosted storefront'}</span>
              <h2>{account ? 'Fresh listings' : 'Featured products'}</h2>
            </div>
            <div className="category-tabs" aria-label="Product categories">
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={category === selectedCategory ? 'active' : ''}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {loading && account ? (
            <div className="loader" aria-live="polite">
              <span className="spinner"></span>
              Syncing listings
            </div>
          ) : visibleProducts.length > 0 ? (
            <div className="product-grid">
              {visibleProducts.map(renderProductCard)}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No listings found</strong>
              <span>Try another search or category.</span>
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>BlockMart marketplace</span>
        <span>Built by Saurabh Kumar</span>
      </footer>
    </div>
  );
}

export default App;
