const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connection = require('./config/db');

const authRoutes = require('./routes/AuthRoutes');
const pharmacyRoutes = require('./routes/PharmacyRoutes');
const medicineRoutes = require('./routes/MedicineRoutes');
const adminRoutes =  require('./routes/AdminRoutes');


const authMiddleware = require('./middleware/authMiddleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

connection();

app.use('/auth', authRoutes);
app.use('/pharmacy', pharmacyRoutes);
app.use('/medicine', medicineRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('Medicine Availability Tracker API Running 🚀');
});

app.get('/test', authMiddleware, (req, res) => {
  res.json({
    msg: 'Middleware Working',
    user: req.user
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
