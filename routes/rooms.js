const express = require('express');
const { ObjectId } = require('mongodb');

module.exports = (roomsCollection, verifyToken, verifyHost) => {
  const router = express.Router();

  // Get all rooms from db
  router.get('/rooms', async (req, res) => {
    const category = req.query.category;
    let query = {};
    if (category && category !== 'null') query = { category };
    const result = await roomsCollection.find(query).toArray();
    res.send(result);
  });

  // save a room data in db
  router.post('/room', verifyToken, verifyHost, async (req, res) => {
    const roomData = req.body;
    const result = await roomsCollection.insertOne(roomData);
    res.send(result);
  });

  // get all rooms for host
  router.get('/my-listings/:email', verifyToken, verifyHost, async (req, res) => {
    const email = req.params.email;
    const query = { 'host.email': email };
    const result = await roomsCollection.find(query).toArray();
    res.send(result);
  });

  // update room data
  router.put('/room/update/:id', verifyToken, verifyHost, async (req, res) => {
    const id = req.params.id;
    const roomData = req.body;
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: roomData,
    };
    const result = await roomsCollection.updateOne(query, updateDoc);
    res.send(result);
  });

  // UPDATE ROOM STATUS
  router.patch('/room/status/:id', async (req, res) => {
    const id = req.params.id;
    const status = req.body.status;
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        booked: status,
      },
    };
    const result = await roomsCollection.updateOne(query, updateDoc);
    res.send(result);
  });

  // get a single data from db using_id
  router.get('/room/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await roomsCollection.findOne(query);
    res.send(result);
  });

  // delete a room
  router.delete('/room/:id', verifyToken, verifyHost, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await roomsCollection.deleteOne(query);
    res.send(result);
  });

  return router;
};
