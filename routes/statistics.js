const express = require('express');

module.exports = (usersCollection, roomsCollection, bookingsCollection, verifyToken, verifyAdmin, verifyHost) => {
  const router = express.Router();

  // admin statistics
  router.get('/admin-stat', verifyToken, verifyAdmin, async (req, res) => {
    const bookingDetails = await bookingsCollection
      .find(
        {},
        {
          projection: {
            date: 1,
            price: 1,
          },
        }
      )
      .toArray();

    const totalUsers = await usersCollection.countDocuments();
    const totalRooms = await roomsCollection.countDocuments();
    const totalPrice = bookingDetails.reduce(
      (sum, booking) => sum + booking.price,
      0
    );

    const chartData = bookingDetails.map((booking) => {
      const day = new Date(booking.date).getDate();
      const month = new Date(booking.date).getMonth() + 1;
      const data = [`${day}/${month}`, booking?.price];
      return data;
    });
    chartData.unshift(['Day', 'Sales']);

    res.send({
      totalUsers,
      totalRooms,
      totalBookings: bookingDetails.length,
      totalPrice,
      chartData,
    });
  });

  // host statistics
  router.get('/host-stat', verifyToken, verifyHost, async (req, res) => {
    const { email } = req.user;
    const bookingDetails = await bookingsCollection
      .find(
        { 'host.email': email },
        {
          projection: {
            date: 1,
            price: 1,
          },
        }
      )
      .toArray();

    const totalRooms = await roomsCollection.countDocuments({
      'host.email': email,
    });
    const totalPrice = bookingDetails.reduce(
      (sum, booking) => sum + booking.price,
      0
    );
    const { timestamp } = await usersCollection.findOne(
      { email },
      { projection: { timestamp: 1 } }
    );

    const chartData = bookingDetails.map((booking) => {
      const day = new Date(booking.date).getDate();
      const month = new Date(booking.date).getMonth() + 1;
      const data = [`${day}/${month}`, booking?.price];
      return data;
    });
    chartData.unshift(['Day', 'Sales']);

    res.send({
      totalRooms,
      totalBookings: bookingDetails.length,
      totalPrice,
      chartData,
      hostSince: timestamp,
    });
  });

  // guest statistics
  router.get('/guest-stat', verifyToken, async (req, res) => {
    const { email } = req.user;
    const bookingDetails = await bookingsCollection
      .find(
        { 'guest.email': email },
        {
          projection: {
            date: 1,
            price: 1,
          },
        }
      )
      .toArray();

    const totalPrice = bookingDetails.reduce(
      (sum, booking) => sum + booking.price,
      0
    );
    const { timestamp } = await usersCollection.findOne(
      { email },
      { projection: { timestamp: 1 } }
    );

    const chartData = bookingDetails.map((booking) => {
      const day = new Date(booking.date).getDate();
      const month = new Date(booking.date).getMonth() + 1;
      const data = [`${day}/${month}`, booking?.price];
      return data;
    });
    chartData.unshift(['Day', 'Sales']);

    res.send({
      totalBookings: bookingDetails.length,
      totalPrice,
      chartData,
      guestSince: timestamp,
    });
  });

  return router;
};
