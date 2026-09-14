const express = require('express');
const router = express.Router();
const Review = require('../models/review');

router.post('/', async (req, res) => {
  try {
    const { productId, customerName, customerEmail, rating, comment } = req.body;
    const review = new Review({
      product: productId,
      customerName,
      customerEmail,
      rating,
      comment,
      approved: false
    });
    await review.save();
    res.status(201).json({ success: true, message: 'Review submitted for approval' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId, approved: true });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const reviews = await Review.find({ approved: true }).limit(limit).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;  