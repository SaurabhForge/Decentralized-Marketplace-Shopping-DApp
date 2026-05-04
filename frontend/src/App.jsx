import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import contractAddress from './utils/contract-address.json';
import MarketplaceArtifact from './utils/Marketplace.json';
import {
  createHostedOrder,
  fetchCloudConfig,
  fetchFeaturedProducts,
  fetchHostedOrders,
  getCloudApiUrl,
  publishAnalyticsEvent,
} from './services/cloudApi';
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
    price: '0.01',
    owner: 'Verified seller',
    source: 'Cloud catalog',
  },
  {
    id: 'local-2',
    name: 'Cyber Keyboard Pro',
    category: 'Electronics',
    price: '0.005',
    owner: 'Creator store',
    source: 'Cloud catalog',
  },
  {
    id: 'local-3',
    name: 'Quantum SmartWatch',
    category: 'Wearables',
    price: '0.008',
    owner: 'Device studio',
    source: 'Cloud catalog',
  },
];

const categoryOptions = ['All', 'Collectibles', 'Electronics', 'Wearables'];
const marketplaceAbi = Array.isArray(MarketplaceArtifact) ? MarketplaceArtifact : MarketplaceArtifact.abi;
const isLocalContractMode = import.meta.env.VITE_USE_LOCAL_CONTRACT === 'true';
const localContractAddress = isLocalContractMode ? contractAddress.Marketplace : '';
const defaultChainId = isLocalContractMode ? '0x7a69' : '0xaa36a7';
const defaultChainName = isLocalContractMode ? 'Hardhat Localhost' : 'Sepolia';
const defaultRpcUrl = isLocalContractMode ? 'http://127.0.0.1:8545/' : 'https://rpc.sepolia.org';
const walletNetwork = {
  chainId: import.meta.env.VITE_CHAIN_ID_HEX || defaultChainId,
  chainName: import.meta.env.VITE_CHAIN_NAME || defaultChainName,
  rpcUrls: [import.meta.env.VITE_RPC_URL || defaultRpcUrl],
  nativeCurrency: {
    name: import.meta.env.VITE_NATIVE_CURRENCY_NAME || 'ETH',
    symbol: import.meta.env.VITE_NATIVE_CURRENCY_SYMBOL || 'ETH',
    decimals: 18,
  },
};
const shouldSyncWalletNetwork = !isLocalContractMode;
const contractStorageKey = `blockmart-marketplace-contract-${walletNetwork.chainId}`;
const signedOrdersStorageKey = `blockmart-signed-orders-${walletNetwork.chainId}`;
const walletSessionStorageKey = `blockmart-wallet-session-${walletNetwork.chainId}`;
const clearStoredContractAddress = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(contractStorageKey);
  }
};
const getStoredWalletAccount = () => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(walletSessionStorageKey) || '';
};
const rememberWalletAccount = (walletAddress) => {
  if (typeof window !== 'undefined' && walletAddress) {
    window.localStorage.setItem(walletSessionStorageKey, walletAddress);
  }
};
const clearStoredWalletAccount = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(walletSessionStorageKey);
  }
};
const getInitialContractAddress = () => (
  import.meta.env.VITE_MARKETPLACE_CONTRACT_ADDRESS
  || (!import.meta.env.PROD ? localContractAddress : '')
);
const getStoredSignedOrders = () => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem(signedOrdersStorageKey) || '[]');
  } catch {
    return [];
  }
};
const persistSignedOrders = (orders) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(signedOrdersStorageKey, JSON.stringify(orders));
  }
};
const sameHostedOrder = (left, right) => (
  left.productId === right.productId
  && left.account?.toLowerCase?.() === right.account?.toLowerCase?.()
);

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

const formatEthAmount = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  if (numericValue > 0 && numericValue < 0.0001) return '<0.0001';
  return numericValue.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
};

const formatWeiBalance = (balanceWei) => formatEthAmount(ethers.formatEther(balanceWei));

const getOrderStatusLabel = (order) => {
  if (order.syncStatus === 'syncing') return 'Saving receipt';
  if (order.syncStatus === 'local') return 'Saved locally';
  return 'Receipt saved';
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
  const [notice, setNotice] = useState('');
  const [googleUser, setGoogleUser] = useState(null);
  const [cloudApiReady, setCloudApiReady] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isBuying, setIsBuying] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletBalanceEth, setWalletBalanceEth] = useState('');
  const [activeContractAddress, setActiveContractAddress] = useState(getInitialContractAddress);
  const [signedOrders, setSignedOrders] = useState(getStoredSignedOrders);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const shouldUseOnChain = Boolean(activeContractAddress);
  const walletButtonLabel = isConnecting
    ? 'Connecting'
    : account
      ? `Connected ${shortAddress(account)}`
      : 'Connect wallet';

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
  }, [featuredProducts, products, shouldUseOnChain]);

  const visibleProducts = useMemo(() => storefrontProducts.filter((product) => {
    const meta = getProductMeta(product.name);
    const category = normalizeCategory(product.category || meta.category);
    const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  }), [searchTerm, selectedCategory, storefrontProducts]);

  const walletOrders = useMemo(() => signedOrders
    .filter((order) => order.account?.toLowerCase?.() === account?.toLowerCase?.())
    .slice(0, 4), [account, signedOrders]);

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

  const hydrateHostedOrders = async (walletAddress) => {
    try {
      const result = await fetchHostedOrders(walletAddress);
      const remoteOrders = result?.orders || [];
      if (!remoteOrders.length) return;

      setSignedOrders((currentOrders) => {
        const knownOrderIds = new Set(currentOrders.map((order) => order.id));
        const nextOrders = [
          ...remoteOrders
            .filter((order) => !knownOrderIds.has(order.id))
            .map((order) => ({ ...order, syncStatus: 'saved' })),
          ...currentOrders,
        ].slice(0, 50);

        persistSignedOrders(nextOrders);
        return nextOrders;
      });
    } catch (error) {
      console.warn('Unable to load hosted checkout orders', error);
    }
  };

  const upsertHostedOrder = (order) => {
    setSignedOrders((currentOrders) => {
      const nextOrders = [
        order,
        ...currentOrders.filter((item) => !sameHostedOrder(item, order)),
      ].slice(0, 50);

      persistSignedOrders(nextOrders);
      return nextOrders;
    });
  };

  const refreshWalletBalance = async (walletAddress) => {
    if (!window.ethereum || !walletAddress) return null;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const balanceWei = await provider.getBalance(walletAddress);
    const balanceEth = formatWeiBalance(balanceWei);
    setWalletBalanceEth(balanceEth);
    return { provider, balanceWei, balanceEth };
  };

  const ensureSufficientBalance = async (walletAddress, priceEth, productNameToBuy) => {
    const balance = await refreshWalletBalance(walletAddress);
    if (!balance) {
      setError('Unable to read wallet balance. Check MetaMask and try again.');
      return null;
    }

    const priceWei = ethers.parseEther(priceEth.toString());
    if (balance.balanceWei < priceWei) {
      setNotice('');
      setError(
        `Insufficient ${walletNetwork.chainName} ETH for ${productNameToBuy}. `
        + `Price is ${priceEth} ETH, but this wallet has ${balance.balanceEth} ETH. `
        + `Add ${walletNetwork.chainName} test ETH or choose a lower priced item.`,
      );
      return null;
    }

    return balance;
  };

  const checkIfWalletIsConnected = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!shouldUseOnChain) {
        const rememberedAccount = getStoredWalletAccount();
        if (!window.ethereum || !rememberedAccount) {
          setLoading(false);
          return;
        }

        const networkReady = await ensureHostedWalletNetwork({ showNotice: false });
        if (!networkReady) {
          setLoading(false);
          return;
        }

        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const connectedAccount = accounts.find(
          (item) => item.toLowerCase() === rememberedAccount.toLowerCase(),
        ) || accounts[0];

        if (connectedAccount) {
          setAccount(connectedAccount);
          rememberWalletAccount(connectedAccount);
          await Promise.allSettled([
            refreshWalletBalance(connectedAccount),
            hydrateHostedOrders(connectedAccount),
          ]);
        } else {
          clearStoredWalletAccount();
        }

        setLoading(false);
        return;
      }

      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const networkReady = await checkAndSwitchNetwork();
          if (!networkReady) {
            setLoading(false);
            return;
          }

          setAccount(accounts[0]);
          rememberWalletAccount(accounts[0]);
          await refreshWalletBalance(accounts[0]);
          initContract(activeContractAddress);
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
    if (!window.ethereum) return false;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: walletNetwork.chainId }],
      });
      return true;
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
          return true;
        } catch (addError) {
          console.error('Failed to add network', addError);
          setError(`MetaMask could not add ${walletNetwork.chainName}. Add it manually and try again.`);
        }
      } else {
        setError(`Switch MetaMask to ${walletNetwork.chainName} to use wallet actions.`);
      }
    }

    return false;
  };

  const ensureHostedWalletNetwork = async ({ showNotice = true } = {}) => {
    if (!shouldSyncWalletNetwork || !window.ethereum) return true;

    try {
      if (showNotice) {
        setNotice(`Switching MetaMask to ${walletNetwork.chainName}.`);
      }
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: walletNetwork.chainId }],
      });
      return true;
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
          return true;
        } catch (addError) {
          console.error('Unable to add hosted wallet network', addError);
        }
      }

      console.error('Unable to switch hosted wallet network', switchError);
      setError(`Switch MetaMask to ${walletNetwork.chainName}, then try Buy again.`);
      return false;
    }
  };

  const connectWallet = async () => {
    try {
      setError('');
      setNotice('');
      if (!window.ethereum) {
        setError('MetaMask is not available in this browser. Install it to buy or list products.');
        return;
      }

      setIsConnecting(true);
      if (shouldUseOnChain) {
        const networkReady = await checkAndSwitchNetwork();
        if (!networkReady) {
          setLoading(false);
          return;
        }
      } else {
        const networkReady = await ensureHostedWalletNetwork();
        if (!networkReady) {
          setLoading(false);
          return;
        }
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const connectedAccount = accounts[0];
      setAccount(connectedAccount);
      rememberWalletAccount(connectedAccount);
      const balance = await refreshWalletBalance(connectedAccount);

      if (shouldUseOnChain) {
        initContract(activeContractAddress);
      } else {
        await hydrateHostedOrders(connectedAccount);
        setNotice(
          `Wallet connected: ${shortAddress(connectedAccount)}. `
          + `Balance: ${balance?.balanceEth || '0'} ${walletNetwork.chainName} ETH.`,
        );
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setError('Wallet connection was not completed. Open MetaMask and try again.');
    } finally {
      setIsConnecting(false);
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

  const initContract = async (contractAddressToUse = activeContractAddress) => {
    try {
      if (!contractAddressToUse) {
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddressToUse,
        marketplaceAbi,
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

  const resetOnChainMode = () => {
    clearStoredContractAddress();
    setActiveContractAddress('');
    setMarketplace(null);
    setProducts([]);
    setError('');
    setWalletBalanceEth('');
    setNotice('Hosted catalog mode restored. Connected wallets can buy with MetaMask approval.');
    setLoading(false);
  };

  useEffect(() => {
    if (!window.ethereum) return undefined;

    const handleAccountsChanged = async (accounts) => {
      setError('');
      setMarketplace(null);
      setProducts([]);

      if (!accounts.length) {
        setAccount(null);
        setWalletBalanceEth('');
        clearStoredWalletAccount();
        setNotice('Wallet disconnected.');
        setLoading(false);
        return;
      }

      const nextAccount = accounts[0];
      setAccount(nextAccount);
      rememberWalletAccount(nextAccount);

      if (shouldUseOnChain) {
        await refreshWalletBalance(nextAccount);
        await initContract(activeContractAddress);
      } else {
        const balance = await refreshWalletBalance(nextAccount);
        await hydrateHostedOrders(nextAccount);
        setNotice(
          `Wallet changed to ${shortAddress(nextAccount)}. `
          + `Balance: ${balance?.balanceEth || '0'} ${walletNetwork.chainName} ETH.`,
        );
        setLoading(false);
      }
    };

    const handleChainChanged = async () => {
      if (shouldUseOnChain) {
        window.location.reload();
        return;
      }

      if (account) {
        const networkReady = await ensureHostedWalletNetwork({ showNotice: false });
        if (networkReady) {
          await refreshWalletBalance(account);
        }
      }
    };

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [account, activeContractAddress, shouldUseOnChain]);

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
    if (!productName || !productPrice || !marketplace || !shouldUseOnChain) {
      setError('A public marketplace contract is required before hosted listings can be published on-chain.');
      return;
    }

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
      const balance = await ensureSufficientBalance(account, priceStr, `product #${id}`);
      if (!balance) return;

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

  const signHostedOrder = async (product) => {
    try {
      setError('');
      setNotice('');

      if (!window.ethereum) {
        setError('MetaMask is not available in this browser. Install it to sign wallet orders.');
        return;
      }

      setIsBuying(product.id);
      const networkReady = await ensureHostedWalletNetwork();
      if (!networkReady) {
        setIsBuying(null);
        return;
      }

      const accounts = account
        ? [account]
        : await window.ethereum.request({ method: 'eth_requestAccounts' });
      const buyer = accounts[0];
      setAccount(buyer);
      rememberWalletAccount(buyer);

      const balance = await ensureSufficientBalance(buyer, product.price, product.name);
      if (!balance) {
        setIsBuying(null);
        return;
      }

      const provider = balance.provider;
      const signer = await provider.getSigner();
      const timestamp = new Date().toISOString();
      const message = [
        'BlockMart hosted order',
        `Product: ${product.name}`,
        `Product ID: ${product.id}`,
        `Price: ${product.price} ETH`,
        `Buyer: ${buyer}`,
        `Created: ${timestamp}`,
      ].join('\n');
      const signature = await signer.signMessage(message);
      const orderPayload = {
        productId: product.id,
        account: buyer,
        priceEth: product.price,
        createdAt: timestamp,
        message,
        signature,
      };
      const pendingOrder = {
        id: `${buyer.toLowerCase()}_${product.id}`,
        productId: product.id,
        productName: product.name,
        category: product.category,
        priceEth: product.price,
        account: buyer.toLowerCase(),
        buyer,
        signature,
        createdAt: timestamp,
        confirmedAt: timestamp,
        status: 'purchased',
        syncStatus: 'syncing',
      };

      upsertHostedOrder(pendingOrder);
      setNotice(`Wallet approved ${product.name}. Saving your receipt now.`);

      try {
        const result = await createHostedOrder(orderPayload);
        const confirmedOrder = {
          ...pendingOrder,
          ...(result?.order || {}),
          syncStatus: result?.order ? 'saved' : 'local',
        };

        upsertHostedOrder(confirmedOrder);
        setNotice(
          result?.order
            ? `Purchase confirmed for ${product.name}. Your receipt is saved.`
            : `Purchase approved for ${product.name}. Receipt saved on this browser.`,
        );

        await Promise.allSettled([
          publishAnalyticsEvent({
            type: 'hosted_order_signed',
            account: buyer,
            productId: product.id,
            priceEth: product.price,
            message,
            signature,
          }),
          trackMarketplaceEvent('hosted_order_signed', {
            product_id: product.id,
            price_eth: product.price,
          }),
        ]);
      } catch (syncError) {
        console.warn('Checkout approved but cloud order sync failed', syncError);
        upsertHostedOrder({
          ...pendingOrder,
          syncStatus: 'local',
          syncError: syncError.message,
        });
        setNotice(`Purchase approved for ${product.name}. Receipt saved locally; cloud sync can retry later.`);
      }
    } catch (error) {
      console.error('Error signing hosted order', error);
      setError('The checkout was not confirmed. Check MetaMask and try again.');
    } finally {
      setIsBuying(null);
    }
  };

  const renderProductCard = (product) => {
    const meta = getProductMeta(product.name);
    const category = product.category || meta.category;
    const isOnChain = product.source === 'On-chain';
    const isOwner = account && product.owner?.toLowerCase?.() === account.toLowerCase();
    const isSigned = signedOrders.some((order) => (
      order.productId === product.id && order.account?.toLowerCase?.() === account?.toLowerCase?.()
    ));

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
              onClick={() => {
                if (isOnChain) {
                  buyProduct(product.id, product.price.toString());
                } else {
                  signHostedOrder(product);
                }
              }}
              disabled={
                isBuying === product.id
                || isOwner
                || isSigned
              }
              aria-label={`Buy ${product.name}`}
            >
              {isBuying === product.id
                ? 'Processing'
                : isSigned
                  ? 'Purchased'
                  : 'Buy'}
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
            {account && walletBalanceEth && (
              <span className="status-chip balance-chip">
                {walletBalanceEth} {walletNetwork.chainName} ETH
              </span>
            )}
            {account ? (
              <button className="btn btn-secondary wallet-button" aria-label="Connected wallet address" disabled>
                {walletButtonLabel}
              </button>
            ) : (
              <button
                className="btn btn-primary wallet-button"
                onClick={connectWallet}
                aria-label="Connect wallet"
                disabled={isConnecting}
              >
                {walletButtonLabel}
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
              <button
                className={`btn ${account ? 'btn-secondary' : 'btn-primary'}`}
                onClick={account ? undefined : connectWallet}
                disabled={Boolean(account) || isConnecting}
              >
                {walletButtonLabel}
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
              <span>{shouldUseOnChain ? 'Contract' : 'Mode'}</span>
              <strong>{shouldUseOnChain ? shortAddress(activeContractAddress) : account ? 'Wallet checkout' : 'Hosted catalog'}</strong>
            </div>
          </div>
        </section>

        {notice && (
          <div className="alert-info" role="status">
            <strong>Wallet status</strong>
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="alert-error" role="alert">
            <strong>Connection notice</strong>
            <span>{error}</span>
            {activeContractAddress ? (
              <button type="button" className="btn btn-secondary alert-button" onClick={resetOnChainMode}>
                Reset contract
              </button>
            ) : (
              <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">Get MetaMask</a>
            )}
          </div>
        )}

        {account && !shouldUseOnChain && (
          <section className="seller-panel checkout-panel">
            <div>
              <span className="eyebrow">Wallet checkout</span>
              <h2>Ready to buy</h2>
            </div>
            <div className="checkout-copy">
              <p>
                Checkout verifies your Sepolia balance before MetaMask approval. If your wallet is short,
                the app will show a clear warning before any signature request.
              </p>
            </div>
          </section>
        )}

        {account && !shouldUseOnChain && walletOrders.length > 0 && (
          <section className="receipt-panel" aria-label="Purchase receipts">
            <div className="section-header compact">
              <div>
                <span className="eyebrow">After wallet approval</span>
                <h2>Purchase receipts</h2>
              </div>
            </div>
            <div className="receipt-list">
              {walletOrders.map((order) => (
                <article className="receipt-item" key={order.id || `${order.account}-${order.productId}`}>
                  <div>
                    <strong>{order.productName || order.productId}</strong>
                    <span>{shortAddress(order.buyer || order.account)} - {order.priceEth} ETH</span>
                  </div>
                  <span className={`receipt-status ${order.syncStatus || 'saved'}`}>
                    {getOrderStatusLabel(order)}
                  </span>
                </article>
              ))}
            </div>
          </section>
        )}

        {account && shouldUseOnChain && (
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
              <span className="eyebrow">{account && shouldUseOnChain ? 'On-chain inventory' : 'Hosted storefront'}</span>
              <h2>{account && shouldUseOnChain ? 'Fresh listings' : 'Featured products'}</h2>
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

          {loading && account && shouldUseOnChain ? (
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
