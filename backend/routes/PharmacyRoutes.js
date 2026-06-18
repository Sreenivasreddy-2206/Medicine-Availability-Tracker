const express = require('express');
const router = express.Router();

const authMiddleware =
require('../middleware/authMiddleware');

const adminMiddleware =
require('../middleware/adminMiddleware');

const {
  createPharmacy,
  getAllPharmacies,
  getPharmacyById,
  getNearbyPharmacies
} = require('../controllers/PharmacyController');

router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  createPharmacy
);

router.get(
  '/',
  getAllPharmacies
);

router.get(
  '/nearby',
  getNearbyPharmacies
);

router.get(
  '/:id',
  getPharmacyById
);

module.exports = router;