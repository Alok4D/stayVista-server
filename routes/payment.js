const express = require('express');
const stripe = require('stripe')(process.env.VITE_STRIPE_SECRET_KEY);

module.exports = (verifyToken) => {
  const router = express.Router();

  // create payment-intent
  router.post('/create-payment-intent', verifyToken, async (req, res) => {
    const price = req.body.price;
    const priceInCent = parseFloat(price) * 100;
    if (!price || priceInCent < 1) return;
    const { client_secret } = await stripe.paymentIntents.create({
      amount: priceInCent,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
    });
    // send client secret as response
    res.send({ clientSecret: client_secret });
  });

  return router;
};
