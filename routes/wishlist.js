const express = require('express');

module.exports = (wishlistCollection) => {
  const router = express.Router();

  // POST -> Add to wishlist
  router.post('/wishlist', async (req, res) => {
    const item = req.body;
    const exists = await wishlistCollection.findOne({
      roomId: item.roomId,
      userEmail: item.userEmail,
    });

    if (exists) {
      return res.send({ success: false, message: 'Already exists' });
    }

    const result = await wishlistCollection.insertOne(item);
    res.send({ success: true, insertedId: result.insertedId });
  });

  // GET -> Check if already in wishlist
  router.get('/wishlist/check', async (req, res) => {
    const { roomId, userEmail } = req.query;
    const exists = await wishlistCollection.findOne({ roomId, userEmail });
    res.send({ exists: !!exists });
  });

  // DELETE -> Remove from wishlist
  router.delete('/wishlist', async (req, res) => {
    const { roomId, userEmail } = req.query;
    const result = await wishlistCollection.deleteOne({ roomId, userEmail });
    res.send({ success: true, deletedCount: result.deletedCount });
  });

  // GET -> Get all wishlist items for a specific user
  router.get('/wishlist', async (req, res) => {
    try {
      const { email } = req.query;
      if (!email) {
        return res.status(400).send({ success: false, message: 'Email is required' });
      }

      const result = await wishlistCollection.find({ userEmail: email }).toArray();
      res.send({ success: true, data: result });
    } catch (err) {
      console.error('Error fetching wishlist:', err);
      res.status(500).send({ success: false, message: 'Server error' });
    }
  });

  return router;
};
