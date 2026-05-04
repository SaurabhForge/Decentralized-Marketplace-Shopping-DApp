import { Firestore } from '@google-cloud/firestore';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import Joi from 'joi';
import morgan from 'morgan';

const app = express();
const port = Number(process.env.PORT || 8080);
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || '';
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const renderFrontendOriginPattern = /^https:\/\/blockmart-marketplace-frontend(?:-[a-z0-9-]+)?\.onrender\.com$/;

const firestore = projectId
  ? new Firestore({
    projectId,
    databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
  })
  : null;

const featuredProducts = [
  {
    id: 'cloud-nft-1',
    name: 'Genesis NFT',
    category: 'Digital Collectible',
    priceEth: '0.85',
  },
  {
    id: 'cloud-keyboard-1',
    name: 'Cyber Keyboard Pro',
    category: 'Hardware',
    priceEth: '0.12',
  },
  {
    id: 'cloud-watch-1',
    name: 'Quantum SmartWatch',
    category: 'Wearable',
    priceEth: '0.45',
  },
];

const eventSchema = Joi.object({
  type: Joi.string().valid(
    'product_listed',
    'product_purchased',
    'contract_deployed',
    'hosted_order_signed',
  ).required(),
  account: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  productId: Joi.alternatives().try(
    Joi.number().integer().positive(),
    Joi.string().max(120),
  ).optional(),
  priceEth: Joi.string().optional(),
  transactionHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).optional(),
  contractAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  message: Joi.string().max(1200).optional(),
  signature: Joi.string().pattern(/^0x[a-fA-F0-9]+$/).optional(),
}).unknown(false);

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '32kb' }));
app.use(morgan('combined'));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || renderFrontendOriginPattern.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin is not allowed by CORS'));
  },
}));
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}));

app.get('/', (request, response) => {
  const baseUrl = `${request.protocol}://${request.get('host')}`;

  response.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BlockMart GCP API</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Inter, Arial, sans-serif;
        background: #07090f;
        color: #f8fafc;
      }
      main {
        width: min(720px, calc(100% - 32px));
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 16px;
        padding: 32px;
        background: #11141f;
      }
      h1 {
        margin: 0 0 12px;
        color: #22c55e;
      }
      p {
        color: #cbd5e1;
        line-height: 1.6;
      }
      a {
        color: #38bdf8;
      }
      code {
        background: rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        padding: 2px 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>BlockMart GCP API is running</h1>
      <p>This Cloud Run service powers the BlockMart decentralized marketplace frontend.</p>
      <p>Available endpoints:</p>
      <p><a href="${baseUrl}/health"><code>/health</code></a></p>
      <p><a href="${baseUrl}/api/config"><code>/api/config</code></a></p>
      <p><a href="${baseUrl}/api/products/featured"><code>/api/products/featured</code></a></p>
    </main>
  </body>
</html>`);
});

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'blockmart-gcp-api',
    projectId: projectId || null,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/config', (_request, response) => {
  response.json({
    chainId: Number(process.env.CHAIN_ID || 31337),
    contractAddress: process.env.MARKETPLACE_CONTRACT_ADDRESS || null,
    rpcUrl: process.env.RPC_URL || null,
    projectId: projectId || null,
    googleServices: {
      cloudRun: true,
      firestore: Boolean(firestore),
      analyticsProxy: true,
    },
  });
});

app.get('/api/products/featured', async (_request, response, next) => {
  try {
    if (!firestore) {
      response.json({ products: featuredProducts, source: 'fallback' });
      return;
    }

    const snapshot = await firestore.collection('marketplace_featured_products').limit(12).get();
    const products = snapshot.empty
      ? featuredProducts
      : snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    response.json({
      products,
      source: snapshot.empty ? 'fallback' : 'firestore',
    });
  } catch (error) {
    console.warn('Using fallback featured products because Firestore is unavailable', error);
    response.json({ products: featuredProducts, source: 'fallback' });
  }
});

app.post('/api/analytics/purchase', async (request, response, next) => {
  try {
    const { value, error } = eventSchema.validate(request.body);
    if (error) {
      response.status(400).json({ error: error.message });
      return;
    }

    const event = {
      ...value,
      createdAt: new Date().toISOString(),
      userAgent: request.get('user-agent') || null,
    };

    if (firestore) {
      try {
        const document = await firestore.collection('marketplace_events').add(event);
        response.status(201).json({ ok: true, id: document.id });
      } catch (error) {
        console.warn('Accepted event without Firestore persistence', error);
        response.status(202).json({ ok: true, id: null, mode: 'accepted' });
      }
      return;
    }

    response.status(202).json({ ok: true, id: null, mode: 'local' });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    error: 'Internal server error',
  });
});

app.listen(port, () => {
  console.log(`BlockMart GCP API listening on port ${port}`);
});
