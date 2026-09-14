const express = require('express');
const router = express.Router();
const Product = require('../models/product');

router.get('/', async (req, res) => {
  try {
    const { search, sort, page = 1, limit = 9 } = req.query;

    const query = { active: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'price-asc':
        sortOption = { price: 1 };
        break;
      case 'price-desc':
        sortOption = { price: -1 };
        break;
      case 'rating':
        sortOption = { rating: -1 };
        break;
      case 'popularity':
        sortOption = { reviewCount: -1 };
        break;
      case 'newest':
      default:
        sortOption = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    res.json(products);
  } catch (error) {
    console.error('GET /api/products error:', error);
    res.status(500).json({ error: error.message });
  }
});

 
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ featured: true, active: true }).limit(8);
    res.json(products);
  } catch (error) {
    console.error('GET /api/products/featured error:', error);
    res.status(500).json({ error: error.message });
  }
});

 
router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error('GET /api/products/:slug error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;