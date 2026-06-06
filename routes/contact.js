const express = require('express');
const { ObjectId } = require('mongodb');

module.exports = (contactMessagesCollection, sendEmail, verifyToken, verifyAdmin) => {
  const router = express.Router();

  // Contact form submission - save to DB + send emails
  router.post('/contact', async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).send({ success: false, message: 'All fields are required' });
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
        subject: 'We received your message! ✅',
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

      res.send({ success: true, message: 'Message sent successfully!' });
    } catch (err) {
      console.error('Contact form error:', err);
      res.status(500).send({ success: false, message: 'Failed to send message' });
    }
  });

  // GET all contact messages (admin only)
  router.get('/contact-messages', verifyToken, verifyAdmin, async (req, res) => {
    const result = await contactMessagesCollection
      .find()
      .sort({ timestamp: -1 })
      .toArray();
    res.send(result);
  });

  // PATCH - mark message as read
  router.patch('/contact-messages/:id', verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const result = await contactMessagesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isRead: true } }
    );
    res.send(result);
  });

  // DELETE a contact message
  router.delete('/contact-messages/:id', verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const result = await contactMessagesCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  });

  return router;
};
