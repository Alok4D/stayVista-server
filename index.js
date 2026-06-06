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
  // origin: "http://localhost:5173",
  origin: [
    "https://stay-vista-nu.vercel.app", // Removed trailing slash for consistency
    "https://stay-vista-g4yolgsxd-alok-roys-projects.vercel.app", // Removed trailing slash
    "https://stayvista-live-2025-ce330.web.app", // 👈 Add this origin
  ],
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

    // Mount Modular Routes
    const authRoutes = require("./routes/auth");
    const paymentRoutes = require("./routes/payment");
    const usersRoutes = require("./routes/users");
    const roomsRoutes = require("./routes/rooms");
    const bookingsRoutes = require("./routes/bookings");
    const wishlistRoutes = require("./routes/wishlist");
    const statisticsRoutes = require("./routes/statistics");
    const contactRoutes = require("./routes/contact");

    app.use("/", authRoutes());
    app.use("/", paymentRoutes(verifyToken));
    app.use("/", usersRoutes(usersCollection, verifyToken, verifyAdmin, sendEmail));
    app.use("/", roomsRoutes(roomsCollection, verifyToken, verifyHost));
    app.use("/", bookingsRoutes(bookingsCollection, roomsCollection, verifyToken, verifyHost, sendEmail));
    app.use("/", wishlistRoutes(wishlistCollection));
    app.use("/", statisticsRoutes(usersCollection, roomsCollection, bookingsCollection, verifyToken, verifyAdmin, verifyHost));
    app.use("/", contactRoutes(contactMessagesCollection, sendEmail, verifyToken, verifyAdmin));

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
