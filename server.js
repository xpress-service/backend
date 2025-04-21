const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser')
const path = require('path');
require('dotenv').config();
const cloudinary = require("./cloudinaryConfig");
const Multer = require("multer");


const app = express();
app.use(express.json());
const PORT = process.env.PORT || 5000;


async function handleUpload(file) {
  const res = await cloudinary.uploader.upload(file, {
    resource_type: "auto",
  });
  return res;
}

// Middleware
const allowedOrigins = ['https://servicexpress-tau.vercel.app'];
app.use(cors({
    // origin: 'http://localhost:3000',
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  const storage = new Multer.memoryStorage();
const upload = Multer({
  storage,
});

  app.use(bodyParser.json());
  

mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
  dbName: process.env.DB,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});


app.post("/upload", upload.single("learning/images"), async (req, res) => {
  try {
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    const cldRes = await handleUpload(dataURI);
    res.json(cldRes);
  } catch (error) {
    console.log(error);
    res.send({
      message: error.message,
    });
  }
});

// Import routes
const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const profileRoutes = require('./routes/profile');
const adminAuthRoutes = require('./routes/adminAuth');
const adminProfileRoutes = require('./routes/adminProfile');

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/adminAuth', adminAuthRoutes);
app.use('/api/adminProfile', adminProfileRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');
// require('dotenv').config();
// const http = require('http'); // Import http for server
// const cloudinary = require("./cloudinaryConfig");
// const Multer = require("multer");

// // Initialize Express App
// const app = express();
// app.use(express.json());
// const PORT = process.env.PORT || 5000;

// // Create HTTP server and bind it with Socket.IO
// const server = http.createServer(app);
// const io = require('socket.io')(server);

// // Socket.IO setup
// io.on('connection', (socket) => {
//   console.log('A user connected');
  
//   socket.on('join', (serviceOwnerId) => {
//     console.log(`User joined room: ${serviceOwnerId}`);
//     socket.join(serviceOwnerId);
//   });

//   socket.on('newOrder', (serviceOwnerId, message) => {
//     console.log(`Sending notification to: ${serviceOwnerId}`);
//     io.to(serviceOwnerId).emit('notification', message);
//   });

//   socket.on('disconnect', () => {
//     console.log('A user disconnected');
//   });
// });

// // Middleware
// app.use(cors({
//   origin: 'http://localhost:3000',
// }));

// const storage = new Multer.memoryStorage();
// const upload = Multer({
//   storage,
// });

// app.use(bodyParser.json());

// // MongoDB Connection
// mongoose.connect(process.env.MONGO_URI, {
//   dbName: process.env.DB,
// });

// const db = mongoose.connection;
// db.on('error', console.error.bind(console, 'connection error:'));
// db.once('open', () => {
//   console.log('Connected to MongoDB');
// });

// // File Upload Route
// async function handleUpload(file) {
//   const res = await cloudinary.uploader.upload(file, {
//     resource_type: "auto",
//   });
//   return res;
// }

// app.post("/upload", upload.single("learning/images"), async (req, res) => {
//   try {
//     const b64 = Buffer.from(req.file.buffer).toString("base64");
//     let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
//     const cldRes = await handleUpload(dataURI);
//     res.json(cldRes);
//   } catch (error) {
//     console.log(error);
//     res.status(500).send({
//       message: error.message,
//     });
//   }
// });

// // Import Routes
// const authRoutes = require('./routes/auth');
// const serviceRoutes = require('./routes/services');
// const orderRoutes = require('./routes/orders');
// const reviewRoutes = require('./routes/reviews');
// const profileRoutes = require('./routes/profile');
// const adminAuthRoutes = require('./routes/adminAuth');
// const adminProfileRoutes = require('./routes/adminProfile');

// app.use('/api/auth', authRoutes);
// app.use('/api/services', serviceRoutes);
// app.use('/api/orders', orderRoutes);
// app.use('/api/reviews', reviewRoutes);
// app.use('/api/profile', profileRoutes);
// app.use('/api/adminAuth', adminAuthRoutes);
// app.use('/api/adminProfile', adminProfileRoutes);

// // Start HTTP Server
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
