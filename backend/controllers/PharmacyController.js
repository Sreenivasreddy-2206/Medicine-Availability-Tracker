const Pharmacy = require('../models/PharmacyModel');

exports.createPharmacy = async (req, res) => {
  try {

    const {
      pharmacyName,
      address,
      phone,
      latitude,
      longitude
    } = req.body;

    const pharmacy = await Pharmacy.create({
      pharmacyName,
      address,
      phone,
      latitude,
      longitude
    });

    res.status(201).json({
      msg: 'Pharmacy Created Successfully',
      pharmacy
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};

exports.getAllPharmacies = async (req, res) => {
  try {

    const pharmacies = await Pharmacy.find();

    res.status(200).json(pharmacies);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};

exports.getPharmacyById = async (req, res) => {
  try {

    const pharmacy = await Pharmacy.findById(
      req.params.id
    );

    if (!pharmacy) {
      return res.status(404).json({
        msg: 'Pharmacy Not Found'
      });
    }

    res.status(200).json(pharmacy);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};

exports.getNearbyPharmacies = async (req, res) => {
  try {

    const { lat, lng } = req.query;

    const pharmacies = await Pharmacy.find();

    const toRad = (value) =>
      (value * Math.PI) / 180;

    const nearby = pharmacies.map((pharmacy) => {

      const R = 6371;

      const dLat = toRad(
        pharmacy.latitude - Number(lat)
      );

      const dLng = toRad(
        pharmacy.longitude - Number(lng)
      );

      const a =
        Math.sin(dLat / 2) *
          Math.sin(dLat / 2) +
        Math.cos(toRad(Number(lat))) *
          Math.cos(toRad(pharmacy.latitude)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);

      const c =
        2 * Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        );

      const distance = R * c;

      return {
        pharmacyId: pharmacy._id,
        pharmacyName: pharmacy.pharmacyName,
        address: pharmacy.address,
        phone: pharmacy.phone,
        latitude: pharmacy.latitude,
        longitude: pharmacy.longitude,
        distanceKm: distance.toFixed(2)
      };

    });

    nearby.sort(
      (a, b) =>
        Number(a.distanceKm) -
        Number(b.distanceKm)
    );

    res.status(200).json(nearby);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};