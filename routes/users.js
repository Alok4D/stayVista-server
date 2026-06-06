const express = require('express');

module.exports = (usersCollection, verifyToken, verifyAdmin, sendEmail) => {
  const router = express.Router();

  // save a user data in db
  router.put('/user', async (req, res) => {
    const user = req.body;
    const query = { email: user?.email };
    // check if user already in db
    const isExist = await usersCollection.findOne(query);

    if (isExist) {
      if (user.status === 'Requested') {
        const result = await usersCollection.updateOne(query, {
          $set: { status: user?.status },
        });
        return res.send(result);
      } else {
        return res.send(isExist);
      }
    }

    // save user for the first time
    const options = { upsert: true };
    const updateDoc = {
      $set: {
        ...user,
        timestamp: Date.now(),
      },
    };
    const result = await usersCollection.updateOne(query, updateDoc, options);

    // welcome to user
    sendEmail(user?.email, {
      subject: 'Welcome to Airbnb',
      message: `Hope you will find you destinations.`,
    });

    res.send(result);
  });

  // get a user info by email from db
  router.get('/user/:email', async (req, res) => {
    const email = req.params.email;
    const result = await usersCollection.findOne({ email });
    res.send(result);
  });

  // get all users data from db
  router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
  });

  // update user role
  router.patch('/users/update/:email', async (req, res) => {
    const email = req.params.email;
    const user = req.body;
    const query = { email };
    const updateDoc = {
      $set: {
        ...user,
        timestamp: Date.now(),
      },
    };
    const result = await usersCollection.updateOne(query, updateDoc);
    res.send(result);
  });

  // delete user
  router.delete('/users/:email', verifyToken, verifyAdmin, async (req, res) => {
    const email = req.params.email;
    const result = await usersCollection.deleteOne({ email });
    res.send(result);
  });

  return router;
};
