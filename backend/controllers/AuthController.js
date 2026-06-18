const User = require('../models/UserModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({
        msg: 'All fields are required'
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        msg: 'User already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role
    });

    res.status(201).json({
      msg: 'Registration Successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
};

const { sendOTPEmail } = require('../utils/gmail');

const otpStore = new Map();

exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ msg: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access Denied: 2FA codes are only generated for Admin roles' });
    }

    // Generate random 6 digit numeric code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in-memory with a 5 minute expiration window
    otpStore.set(email, {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    });

    // Send email via SMTP
    await sendOTPEmail(email, otp);

    res.status(200).json({ msg: 'Verification OTP sent successfully to your email.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        msg: 'All fields are required'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        msg: 'User not found'
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        msg: 'Invalid credentials'
      });
    }

    // Validate 2FA OTP for admins
    if (user.role === 'admin') {
      if (!otp) {
        return res.status(400).json({
          msg: 'OTP is required for Admin login'
        });
      }

      const storedData = otpStore.get(email);
      
      // Perform validation check
      if (!storedData || storedData.otp !== otp || Date.now() > storedData.expires) {
        return res.status(401).json({
          msg: 'Invalid or expired OTP code'
        });
      }

      // Consume the OTP
      otpStore.delete(email);
    }

    const payload = {
      id: user._id,
      username: user.username,
      role: user.role
    };

    const token = jwt.sign(
      payload,
      process.env.SECRET_KEY,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      msg: 'Login Successful',
      token
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
};