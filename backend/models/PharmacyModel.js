const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema(
  {
    pharmacyName: {
      type: String,
      required: true
    },

    address: {
      type: String,
      required: true
    },

    phone: {
      type: String,
      required: true
    },

    latitude: {
      type: Number,
      required: true
    },

    longitude: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'Pharmacy',
  pharmacySchema
);