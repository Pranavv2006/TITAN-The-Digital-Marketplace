/**
 * TITAN Marketplace - MongoDB Seed Script
 * Run once to populate your Atlas collection:
 *   node scripts/seed.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const products = require('../data/products.json');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI is not set in .env');
  process.exit(1);
}

async function seed() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');

    const db = client.db('titan');

    // Drop existing collection to avoid duplicates on re-seed
    const collections = await db.listCollections({ name: 'products' }).toArray();
    if (collections.length > 0) {
      await db.collection('products').drop();
      console.log('Existing products collection dropped');
    }

    // Insert all products
    const result = await db.collection('products').insertMany(products);
    console.log(`Seeded ${result.insertedCount} products successfully`);

    // Create indexes for fast queries
    await db.collection('products').createIndex({ category: 1 });
    await db.collection('products').createIndex({ name: 'text', description: 'text' });
    console.log('Indexes created: category (asc), text search on name & description');

    // Create orders collection index
    await db.collection('orders').createIndex({ createdAt: -1 });
    console.log('Orders index created');

    console.log('\nSeeding complete! Your TITAN store is ready.');
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
