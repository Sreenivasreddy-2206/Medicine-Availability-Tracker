const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const {
  createMedicine,
  bulkCreateMedicines,
  getAllMedicines,
  searchMedicine,
  updateMedicine,
  deleteMedicine
} = require('../controllers/MedicineController');

router.get(
  '/',
  getAllMedicines
);

router.get(
  '/search/:name',
  searchMedicine
);

router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  createMedicine
);

router.post(
  '/bulk',
  authMiddleware,
  adminMiddleware,
  bulkCreateMedicines
);

router.put(
  '/:id',
  authMiddleware,
  adminMiddleware,
  updateMedicine
);

router.delete(
  '/:id',
  authMiddleware,
  adminMiddleware,
  deleteMedicine
);

module.exports = router;