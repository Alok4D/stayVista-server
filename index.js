const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.VITE_STRIPE_SECRET_KEY);

const port = process.env.PORT || 8000;

// middleware
const corsOptions = {
  origin: "http://localhost:5173",
  // origin: [
  //   "https://stay-vista-nu.vercel.app", // Removed trailing slash for consistency
  //   "https://stay-vista-g4yolgsxd-alok-roys-projects.vercel.app", // Removed trailing slash
  //   "https://stayvista-live-2025-ce330.web.app", // 👈 Add this origin
  // ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// send email
const sendEmail = (emailAddress, emailData) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.TRANSPORTER_EMAIL,
      pass: process.env.TRANSPORTER_PASS,
    },
    tls: {
      rejectUnauthorized: false, // ✅ allow self-signed certs
    },
  });
  // verify transporter
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log("Server is ready to take our messages");
    }
  });

  const mailBody = {
    from: `"Airbnb 👻" <${process.env.TRANSPORTER_EMAIL}>`,
    to: emailAddress, // list of receivers
    subject: emailData.subject, // Subject line
    html: emailData.message, // html body
  };

  transporter.sendMail(mailBody, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log("Email Sent: " + info.response);
    }
  });
};

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1yjndj5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const roomsCollection = client.db("stayVista").collection("rooms");
    const usersCollection = client.db("stayVista").collection("users");
    const bookingsCollection = client.db("stayVista").collection("bookings");
    const wishlistCollection = client.db("stayVista").collection("wishlist");


    // verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);
      if (!result || result?.role !== "admin")
        return res.status(401).send({ message: "unauthorized access!" });
      next();
    };

    const verifyHost = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);
      if (result?.role !== "host" && result?.role !== "admin") {
        return res.status(401).send({ message: "unauthorized access!" });
      }
      next();
    };

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // create payment-intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const price = req.body.price;
      const priceInCent = parseFloat(price) * 100;
      if (!price || priceInCent < 1) return;
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      // send client secret as response
      res.send({ clientSecret: client_secret });
    });

    // save a user data in db
    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      // check if user already in db
      const isExist = await usersCollection.findOne(query);

      if (isExist) {
        if (user.status === "Requested") {
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
        subject: "Welcome to Airbnb",
        message: `Hope you will find you destinations.`,
      });

      res.send(result);
    });

    // get a user info by email from db
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // get all users data from db
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // update user role
    app.patch("/users/update/:email", async (req, res) => {
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
    app.delete("/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.deleteOne({ email });
      res.send(result);
    });

    // Get all rooms from db
    app.get("/rooms", async (req, res) => {
      const category = req.query.category;
      let query = {};
      if (category && category !== "null") query = { category };
      const result = await roomsCollection.find(query).toArray();
      res.send(result);
    });

    // save a room data in db
    app.post("/room", verifyToken, verifyHost, async (req, res) => {
      const roomData = req.body;
      const result = await roomsCollection.insertOne(roomData);
      res.send(result);
    });

    // get all rooms for host
    app.get(
      "/my-listings/:email",
      verifyToken,
      verifyHost,
      async (req, res) => {
        const email = req.params.email;
        const query = { "host.email": email };
        const result = await roomsCollection.find(query).toArray();
        res.send(result);
      }
    );

    // delete a room
    app.delete("/room/:id", verifyToken, verifyHost, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.deleteOne(query);
      res.send(result);
    });

    // save a booking data in db
    app.post("/booking", verifyToken, async (req, res) => {
      const bookingData = {
        ...req.body,
        status: "pending", // ✅ add default status
      };
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);

      // send email to guest
      sendEmail(bookingData?.guest?.email, {
        subject: "Booking Successful!",
        message: `You have successfully booked a room through Airbnb. Transaction ID: ${bookingData.transactionId}`,
      });

      // send email to host
      sendEmail(bookingData?.host?.email, {
        subject: "Your Room Got Booked!",
        message: `Get ready to welcome ${bookingData.guest.name}`,
      });
    });

    // approve booking
    app.patch(
      "/booking/approve/:id",
      verifyToken,
      verifyHost,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updateDoc = { $set: { status: "approved" } };
        const result = await bookingsCollection.updateOne(query, updateDoc);
        // optionally mark room booked
        await roomsCollection.updateOne(
          { _id: new ObjectId(req.body.roomId) },
          { $set: { booked: true } }
        );
        res.send(result);
      }
    );

    // cancel booking (without deleting)
    app.patch("/booking/cancel/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { status: "canceled" } };
      // optionally reset room booked
      await bookingsCollection.updateOne(query, updateDoc);
      await roomsCollection.updateOne(
        { _id: new ObjectId(req.body.roomId) },
        { $set: { booked: false } }
      );
      res.send({ success: true });
    });

    // DELETE booking
    app.delete("/booking/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // Cancel booking completely
    app.delete("/booking/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        // find the booking first
        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!booking)
          return res.status(404).send({ message: "Booking not found" });

        // delete booking
        await bookingsCollection.deleteOne({ _id: new ObjectId(id) });

        // reset room booked status
        await roomsCollection.updateOne(
          { _id: new ObjectId(booking.roomId) },
          { $set: { booked: false } }
        );

        res
          .status(200)
          .send({
            success: true,
            message: "Booking canceled and room available",
          });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // update room data
    app.put("/room/update/:id", verifyToken, verifyHost, async (req, res) => {
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
    app.patch("/room/status/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      // change room ability status
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
    app.get("/room/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    });

    // get all booking for a guest
    app.get("/my-bookings/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "guest.email": email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // get all manage-booking for a host
    app.get(
      "/manage-bookings/:email",
      verifyToken,
      verifyHost,
      async (req, res) => {
        const email = req.params.email;
        const query = { "host.email": email };
        const result = await bookingsCollection.find(query).toArray();
        res.send(result);
      }
    );

    // delete a booking
    app.delete("/booking/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // POST -> Add to wishlist
app.post("/wishlist", async (req, res) => {
  const item = req.body;
  const exists = await wishlistCollection.findOne({
    roomId: item.roomId,
    userEmail: item.userEmail,
  });

  if (exists) {
    return res.send({ success: false, message: "Already exists" });
  }

  const result = await wishlistCollection.insertOne(item);
  res.send({ success: true, insertedId: result.insertedId });
});

// GET -> Check if already in wishlist
app.get("/wishlist/check", async (req, res) => {
  const { roomId, userEmail } = req.query;
  const exists = await wishlistCollection.findOne({ roomId, userEmail });
  res.send({ exists: !!exists });
});

// DELETE -> Remove from wishlist
app.delete("/wishlist", async (req, res) => {
  const { roomId, userEmail } = req.query;
  const result = await wishlistCollection.deleteOne({ roomId, userEmail });
  res.send({ success: true, deletedCount: result.deletedCount });
});

// ✅ GET -> Get all wishlist items for a specific user
app.get("/wishlist", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ success: false, message: "Email is required" });
    }

    const result = await wishlistCollection.find({ userEmail: email }).toArray();
    res.send({ success: true, data: result });
  } catch (err) {
    console.error("Error fetching wishlist:", err);
    res.status(500).send({ success: false, message: "Server error" });
  }
});



    // admin statistics
    app.get("/admin-stat", verifyToken, verifyAdmin, async (req, res) => {
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
      chartData.unshift(["Day", "Sales"]);

      // console.log(chartData);
      // console.log(bookingDetails);

      res.send({
        totalUsers,
        totalRooms,
        totalBookings: bookingDetails.length,
        totalPrice,
        chartData,
      });
    });

    // host statistics
    app.get("/host-stat", verifyToken, verifyHost, async (req, res) => {
      const { email } = req.user;
      const bookingDetails = await bookingsCollection
        .find(
          { "host.email": email },
          {
            projection: {
              date: 1,
              price: 1,
            },
          }
        )
        .toArray();

      const totalRooms = await roomsCollection.countDocuments({
        "host.email": email,
      });
      const totalPrice = bookingDetails.reduce(
        (sum, booking) => sum + booking.price,
        0
      );
      const { timestamp } = await usersCollection.findOne(
        { email },
        { projection: { timestamp: 1 } }
      );
      res.timestamp;
      const chartData = bookingDetails.map((booking) => {
        const day = new Date(booking.date).getDate();
        const month = new Date(booking.date).getMonth() + 1;
        const data = [`${day}/${month}`, booking?.price];
        return data;
      });
      chartData.unshift(["Day", "Sales"]);
      // chartData.splice(0, 0, ['Day', 'Sales'])

      // console.log(chartData);

      // console.log(bookingDetails);
      res.send({
        totalRooms,
        totalBookings: bookingDetails.length,
        totalPrice,
        chartData,
        hostSince: timestamp,
      });
    });

    // guest statistics
    app.get("/guest-stat", verifyToken, async (req, res) => {
      const { email } = req.user;
      const bookingDetails = await bookingsCollection
        .find(
          { "guest.email": email },
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
      res.timestamp;
      const chartData = bookingDetails.map((booking) => {
        const day = new Date(booking.date).getDate();
        const month = new Date(booking.date).getMonth() + 1;
        const data = [`${day}/${month}`, booking?.price];
        return data;
      });
      chartData.unshift(["Day", "Sales"]);
      // chartData.splice(0, 0, ['Day', 'Sales'])

      // console.log(chartData);
      // console.log(bookingDetails);

      res.send({
        totalBookings: bookingDetails.length,
        totalPrice,
        chartData,
        guestSince: timestamp,
      });
    });

    const contactMessagesCollection = client.db("stayVista").collection("contactMessages");

    // Contact form submission - save to DB + send emails
    app.post("/contact", async (req, res) => {
      const { name, email, message } = req.body;

      if (!name || !email || !message) {
        return res.status(400).send({ success: false, message: "All fields are required" });
      }

      try {
        // Save message to MongoDB
        const contactData = {
          name,
          email,
          message,
          isRead: false,
          timestamp: Date.now(),
        };
        await contactMessagesCollection.insertOne(contactData);

        // Send email to admin
        sendEmail(process.env.TRANSPORTER_EMAIL, {
          subject: `📩 New Contact Message from ${name}`,
          message: `
            <h3>New Contact Form Submission</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong> ${message}</p>
          `,
        });

        // Send confirmation to the user
        sendEmail(email, {
          subject: "We received your message! ✅",
          message: `
            <h3>Hi ${name},</h3>
            <p>Thank you for contacting StayVista! We have received your message and will get back to you shortly.</p>
            <br/>
            <p><strong>Your message:</strong></p>
            <p>${message}</p>
            <br/>
            <p>Best regards,<br/>StayVista Team</p>
          `,
        });

        res.send({ success: true, message: "Message sent successfully!" });
      } catch (err) {
        console.error("Contact form error:", err);
        res.status(500).send({ success: false, message: "Failed to send message" });
      }
    });

    // GET all contact messages (admin only)
    app.get("/contact-messages", verifyToken, verifyAdmin, async (req, res) => {
      const result = await contactMessagesCollection
        .find()
        .sort({ timestamp: -1 })
        .toArray();
      res.send(result);
    });

    // PATCH - mark message as read
    app.patch("/contact-messages/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await contactMessagesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isRead: true } }
      );
      res.send(result);
    });

    // DELETE a contact message
    app.delete("/contact-messages/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await contactMessagesCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Send a ping to confirm a successful connection

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from StayVista Server..");
});

app.listen(port, () => {
  console.log(`StayVista is running on port ${port}`);
});
