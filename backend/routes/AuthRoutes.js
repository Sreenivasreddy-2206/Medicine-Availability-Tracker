const express = require('express');
const router = express.Router();

const {
  register,
  login,
  sendOTP
} = require('../controllers/AuthController');

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendOTP);

module.exports = router;