/**
 * TITAN Marketplace — Express Server
 * Endpoints:
 *   GET  /api/products          – all products (supports ?category= & ?search=)
 *   GET  /api/products/:id      – single product
 *   GET  /api/categories        – distinct category list
 *   POST /api/checkout          – create order
 *   GET  /api/orders/:id        – fetch order by id (confirmation page)
 */

require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB Connection ──────────────────────────────────────────────────────────
let db;

async function connectDB() {
  if (!MONGO_URI) {
    console.error('MONGO_URI is not defined. Check your .env file.');
    process.exit(1);
  }
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db('titan');
  console.log('MongoDB Atlas connected');
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/products
 * Supports optional query params:
 *   ?category=electronics
 *   ?search=headphones
 *   ?sort=price_asc | price_desc | rating
 */
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, sort } = req.query;
    let query = {};

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    let sortOption = {};
    if (sort === 'price_asc') sortOption = { price: 1 };
    else if (sort === 'price_desc') sortOption = { price: -1 };
    else if (sort === 'rating') sortOption = { rating: -1 };
    else sortOption = { _id: 1 }; // default: insertion order

    const products = await db
      .collection('products')
      .find(query)
      .sort(sortOption)
      .toArray();

    res.json(products);
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/:id
 */
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await db
      .collection('products')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: 'Invalid product ID' });
  }
});

/**
 * GET /api/categories
 * Returns array of distinct category strings + their counts
 */
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db
      .collection('products')
      .aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/checkout
 * Body: { customer: { name, email, address }, items: [...], total: number }
 *
 * SECURITY: Total is re-calculated server-side from DB prices to prevent
 * price tampering from the frontend.
 */
app.post('/api/checkout', async (req, res) => {
  try {
    const { customer, items } = req.body;

    if (!customer || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid order payload' });
    }

    // Validate required customer fields
    if (!customer.name || !customer.email) {
      return res.status(400).json({ error: 'Customer name and email are required' });
    }

    // ── Server-side price re-calculation (security: never trust client total) ──
    let serverTotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const product = await db
        .collection('products')
        .findOne({ _id: new ObjectId(String(item._id)) });

      if (!product) {
        return res
          .status(400)
          .json({ error: `Product not found: ${item._id}` });
      }

      const qty = Math.max(1, parseInt(item.quantity) || 1);
      serverTotal += product.price * qty;
      verifiedItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: qty,
      });
    }

    const order = {
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim().toLowerCase(),
        address: customer.address || '',
      },
      items: verifiedItems,
      total: Math.round(serverTotal * 100) / 100, // rounded to 2 decimal places
      status: 'pending',
      createdAt: new Date(),
    };

    const result = await db.collection('orders').insertOne(order);

    res.status(201).json({
      orderId: result.insertedId,
      total: order.total,
      message: 'Order placed successfully',
    });
  } catch (err) {
    console.error('POST /api/checkout error:', err);
    res.status(500).json({ error: 'Checkout failed. Please try again.' });
  }
});

/**
 * GET /api/orders/:id  –  used by confirmation page
 */
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await db
      .collection('orders')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: 'Invalid order ID' });
  }
});

// ─── SPA fallback – serve index.html for any unknown route ──────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () =>
    console.log(`TITAN server running → http://localhost:${PORT}`)
  );
});
