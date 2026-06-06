const express = require('express');
const jwt = require('jsonwebtoken');

module.exports = () => {
  const router = express.Router();

  // auth related api
  router.post('/jwt', async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '365d',
    });
    res
      .cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      })
      .send({ success: true });
  });

  // Logout
  router.get('/logout', async (req, res) => {
    try {
      res
        .clearCookie('token', {
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
      console.log('Logout successful');
    } catch (err) {
      res.status(500).send(err);
    }
  });

  return router;
};
