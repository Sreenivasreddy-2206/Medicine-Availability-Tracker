const User = require('../models/UserModel');
const Pharmacy = require('../models/PharmacyModel');
const Medicine = require('../models/MedicineModel');

exports.getAllUsers = async (req, res) => {
  try {

    const users = await User.find()
      .select('-password');

    res.status(200).json(users);

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

exports.getAllMedicines = async (req, res) => {
  try {

    const medicines = await Medicine.find()
      .populate(
        'pharmacyId',
        'pharmacyName'
      );

    res.status(200).json(medicines);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};

exports.deleteUser = async (req, res) => {
  try {

    const user = await User.findByIdAndDelete(
      req.params.id
    );

    if (!user) {
      return res.status(404).json({
        msg: 'User Not Found'
      });
    }

    res.status(200).json({
      msg: 'User Deleted Successfully'
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};

exports.deletePharmacy = async (req, res) => {
  try {

    const pharmacy =
      await Pharmacy.findByIdAndDelete(
        req.params.id
      );

    if (!pharmacy) {
      return res.status(404).json({
        msg: 'Pharmacy Not Found'
      });
    }

    res.status(200).json({
      msg: 'Pharmacy Deleted Successfully'
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};