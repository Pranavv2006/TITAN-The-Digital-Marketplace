# ⬡ TITAN — The Digital Marketplace

A full-stack e-commerce store built with **Node.js + Express + MongoDB Atlas** on the backend and a **vanilla JS SPA** on the frontend. Products are served from MongoDB, cart state persists in `localStorage`, and orders are saved to a permanent `orders` collection.

---

## Features

| Area | Details |
|---|---|
| **Product Catalog** | Fetched from MongoDB Atlas on every load |
| **Category Filter** | Click tabs or use `/?category=electronics` URL params |
| **Search** | Case-insensitive regex search across name & description |
| **Sort** | Featured / Price low→high / Price high→low / Top Rated |
| **Cart Engine** | localStorage-persisted, quantity management, no duplicates |
| **Checkout** | Customer form → POST `/api/checkout` |
| **Server-side price verification** | Total re-calculated from DB to prevent price tampering |
| **Micro-animations** | Pop on add-to-cart, cart badge bump, card hover, orbit hero |
| **Loading spinners** | Shown while API calls are pending |
| **Empty states** | Friendly messages for empty cart & no search results |
| **Deployment** | Vercel-ready (`vercel.json` included) |

---

## Project Structure

```
TITAN-The-Digital-Marketplace/
├── server.js              # Express API server
├── package.json
├── vercel.json            # Vercel deployment config
├── .env.example           # Environment variable template
├── .gitignore
├── data/
│   └── products.json      # 16 seed products (5 categories)
├── scripts/
│   └── seed.js            # One-time MongoDB seeder
└── public/                # Static frontend (served by Express)
    ├── index.html
    ├── css/
    │   └── styles.css
    └── js/
        └── app.js
```

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and paste your MongoDB Atlas connection string
```

### 3. Seed the database

Run **once** to populate your `titan.products` collection:

```bash
npm run seed
```

### 4. Start the dev server

```bash
npm run dev      # uses nodemon (auto-reload)
# or
npm start        # production
```

Open **http://localhost:3000**

---

## API Reference

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/products` | All products. Supports `?category=`, `?search=`, `?sort=` |
| `GET` | `/api/products/:id` | Single product by MongoDB `_id` |
| `GET` | `/api/categories` | Distinct categories with counts |
| `POST` | `/api/checkout` | Create an order. Body: `{ customer, items, total }` |
| `GET` | `/api/orders/:id` | Fetch a placed order by ID |

### Filtered Product Query Examples

```
/api/products?category=electronics
/api/products?search=headphones
/api/products?category=clothing&sort=price_asc
```

---

## Cart Engine (localStorage)

The cart is stored under the key `titan_cart` in `localStorage`. No login required.

- Adding the same product **increments quantity** instead of duplicating
- Cart survives page reloads and tab closes
- Quantity controls (`+` / `−`) in the drawer
- Full cart cleared after successful checkout

---

## Security Note

The `total` sent from the frontend is **ignored**. The server fetches each product's price from MongoDB and re-calculates the total server-side to prevent price-tampering attacks.

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add your `MONGO_URI` as an environment variable in the Vercel dashboard under **Settings → Environment Variables**.

---

## Tech Stack

- **Backend:** Node.js 18+, Express 4, MongoDB Node Driver 6
- **Database:** MongoDB Atlas (free M0 tier works fine)
- **Frontend:** Vanilla JS (ES2022), CSS custom properties, Inter font
- **Deployment:** Vercel (serverless)
