const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    medicineName: {
      type: String,
      required: true
    },

    manufacturer: {
      type: String,
      required: true
    },

    price: {
      type: Number,
      required: true
    },

    quantity: {
      type: Number,
      required: true
    },

    expiryDate: {
      type: Date,
      required: true
    },

    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'Medicine',
  medicineSchema
);