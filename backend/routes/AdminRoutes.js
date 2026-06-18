const express = require('express');
const router = express.Router();

const authMiddleware =
require('../middleware/authMiddleware');

const adminMiddleware =
require('../middleware/adminMiddleware');

const {
  getAllUsers,
  getAllPharmacies,
  getAllMedicines,
  deleteUser,
  deletePharmacy
} = require('../controllers/AdminController');

router.get(
  '/users',
  authMiddleware,
  adminMiddleware,
  getAllUsers
);

router.get(
  '/pharmacies',
  authMiddleware,
  adminMiddleware,
  getAllPharmacies
);

router.get(
  '/medicines',
  authMiddleware,
  adminMiddleware,
  getAllMedicines
);

router.delete(
  '/user/:id',
  authMiddleware,
  adminMiddleware,
  deleteUser
);

router.delete(
  '/pharmacy/:id',
  authMiddleware,
  adminMiddleware,
  deletePharmacy
);

module.exports = router;