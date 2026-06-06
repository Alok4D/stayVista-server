const express = require('express');
const { ObjectId } = require('mongodb');

module.exports = (bookingsCollection, roomsCollection, verifyToken, verifyHost, sendEmail) => {
  const router = express.Router();

  // save a booking data in db
  router.post('/booking', verifyToken, async (req, res) => {
    const bookingData = {
      ...req.body,
      status: 'pending', // ✅ add default status
    };
    const result = await bookingsCollection.insertOne(bookingData);
    res.send(result);

    // send email to guest
    sendEmail(bookingData?.guest?.email, {
      subject: 'Booking Successful!',
      message: `You have successfully booked a room through Airbnb. Transaction ID: ${bookingData.transactionId}`,
    });

    // send email to host
    sendEmail(bookingData?.host?.email, {
      subject: 'Your Room Got Booked!',
      message: `Get ready to welcome ${bookingData.guest.name}`,
    });
  });

  // approve booking
  router.patch('/booking/approve/:id', verifyToken, verifyHost, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const updateDoc = { $set: { status: 'approved' } };
    const result = await bookingsCollection.updateOne(query, updateDoc);
    // optionally mark room booked
    await roomsCollection.updateOne(
      { _id: new ObjectId(req.body.roomId) },
      { $set: { booked: true } }
    );
    res.send(result);
  });

  // cancel booking (without deleting)
  router.patch('/booking/cancel/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const updateDoc = { $set: { status: 'canceled' } };
    await bookingsCollection.updateOne(query, updateDoc);
    await roomsCollection.updateOne(
      { _id: new ObjectId(req.body.roomId) },
      { $set: { booked: false } }
    );
    res.send({ success: true });
  });

  // Cancel booking completely
  router.delete('/booking/:id', verifyToken, async (req, res) => {
    try {
      const id = req.params.id;

      // find the booking first
      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!booking)
        return res.status(404).send({ message: 'Booking not found' });

      // delete booking
      await bookingsCollection.deleteOne({ _id: new ObjectId(id) });

      // reset room booked status
      await roomsCollection.updateOne(
        { _id: new ObjectId(booking.roomId) },
        { $set: { booked: false } }
      );

      res.status(200).send({
        success: true,
        message: 'Booking canceled and room available',
      });
    } catch (err) {
      console.error(err);
      res.status(500).send({ success: false, message: 'Server error' });
    }
  });

  // get all booking for a guest
  router.get('/my-bookings/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    const query = { 'guest.email': email };
    const result = await bookingsCollection.find(query).toArray();
    res.send(result);
  });

  // get all manage-booking for a host
  router.get('/manage-bookings/:email', verifyToken, verifyHost, async (req, res) => {
    const email = req.params.email;
    const query = { 'host.email': email };
    const result = await bookingsCollection.find(query).toArray();
    res.send(result);
  });

  return router;
};
