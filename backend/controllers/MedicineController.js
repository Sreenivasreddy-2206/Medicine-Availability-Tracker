const Medicine = require('../models/MedicineModel');
const Pharmacy = require('../models/PharmacyModel');

exports.createMedicine = async (req, res) => {
  try {

    const medicine = await Medicine.create(req.body);

    res.status(201).json({
      msg: 'Medicine Added Successfully',
      medicine
    });

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
        'pharmacyName address phone'
      );

    res.status(200).json(medicines);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};

exports.searchMedicine = async (req, res) => {
  try {

    const medicineName = req.params.name;

    const medicines = await Medicine.find({
      medicineName: {
        $regex: medicineName,
        $options: 'i'
      }
    }).populate(
      'pharmacyId',
      'pharmacyName address phone latitude longitude'
    );

    res.status(200).json(medicines);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};

exports.updateMedicine = async (req, res) => {
  try {

    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!medicine) {
      return res.status(404).json({
        msg: 'Medicine Not Found'
      });
    }

    res.status(200).json({
      msg: 'Medicine Updated Successfully',
      medicine
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};

exports.deleteMedicine = async (req, res) => {
  try {

    const medicine = await Medicine.findByIdAndDelete(
      req.params.id
    );

    if (!medicine) {
      return res.status(404).json({
        msg: 'Medicine Not Found'
      });
    }

    res.status(200).json({
      msg: 'Medicine Deleted Successfully'
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};

exports.bulkCreateMedicines = async (req, res) => {
  try {

    const medicines = req.body;

    const savedMedicines =
      await Medicine.insertMany(medicines);

    res.status(201).json({
      msg: 'Medicines Added Successfully',
      count: savedMedicines.length
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
};