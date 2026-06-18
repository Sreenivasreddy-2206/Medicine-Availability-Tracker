const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// In-Memory Database Storage
const mockDb = {
  User: [],
  Pharmacy: [],
  Medicine: []
};

// Seed default data dynamically at startup
const seedMockData = () => {
  const salt = bcrypt.genSaltSync(10);
  
  // Seed Default User
  mockDb.User.push({
    _id: 'mock_user_1',
    username: 'John Doe',
    email: 'user@medifind.com',
    password: bcrypt.hashSync('password', salt),
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Seed Default Admin
  mockDb.User.push({
    _id: 'mock_admin_1',
    username: 'Admin Manager',
    email: 'admin@medifind.com',
    password: bcrypt.hashSync('adminpassword', salt),
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Seed Default Pharmacies (centered around Vijayawada lat/lng)
  mockDb.Pharmacy.push(
    {
      _id: 'mock_pharm_1',
      pharmacyName: "LifeCare Pharmacy",
      address: "7-12 Apollo Square Road, Landmark Tower",
      phone: "+91 866-5550102",
      latitude: 16.508,
      longitude: 80.645,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'mock_pharm_2',
      pharmacyName: "Apollo Pharmacy Store",
      address: "M.G. Road Cross, Opp. Metro Station",
      phone: "+91 866-5550293",
      latitude: 16.514,
      longitude: 80.651,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'mock_pharm_3',
      pharmacyName: "MedPlus Drug & General Store",
      address: "Subbarao Colony Main Street",
      phone: "+91 866-5550481",
      latitude: 16.498,
      longitude: 80.639,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'mock_pharm_4',
      pharmacyName: "Wellness Forever 24x7",
      address: "Station Road, beside Railway Station Plaza",
      phone: "+91 866-5559902",
      latitude: 16.502,
      longitude: 80.642,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );

  // Seed Default Medicines linked to Pharmacies
  const meds = [
    { name: "Paracetamol 650mg", mfg: "Dolo Industries", price: 30, qty: 45 },
    { name: "Amoxicillin 500mg", mfg: "Abbott Pharma", price: 120, qty: 0 }, // Out of stock target
    { name: "Metformin 500mg", mfg: "Glycomet Labs", price: 45, qty: 18 },
    { name: "Ibuprofen 400mg", mfg: "Combiflam Ltd", price: 20, qty: 80 },
    { name: "Atorvastatin 10mg", mfg: "Pfizer India", price: 180, qty: 8 }, // Low stock target
    { name: "Omeprazole 20mg", mfg: "Dr. Reddy's Labs", price: 60, qty: 50 },
    { name: "Cetirizine 10mg", mfg: "Cipla Biotech", price: 18, qty: 25 },
    { name: "Azithromycin 500mg", mfg: "Azee Med", price: 110, qty: 14 }
  ];

  let medIdCounter = 1;
  mockDb.Pharmacy.forEach(pharm => {
    meds.forEach(med => {
      // Apply a small random variance to seed quantities
      let quantity = med.qty;
      if (med.qty > 0) {
        quantity = Math.floor(Math.random() * 30) + 5;
      }
      mockDb.Medicine.push({
        _id: `mock_med_${medIdCounter++}`,
        medicineName: med.name,
        manufacturer: med.mfg,
        price: med.price,
        quantity: quantity,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * (1 + Math.random())).toISOString(),
        pharmacyId: pharm._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
  });

  console.log('💡 [MockDB] Seeded fallback credentials and medical mock inventories:');
  console.log('   👤 User: user@medifind.com / password');
  console.log('   🔐 Admin: admin@medifind.com / adminpassword');
  console.log(`   🏥 Seeded ${mockDb.Pharmacy.length} pharmacies and ${mockDb.Medicine.length} medicine stock records.`);
};

seedMockData();

// Mock Query Chain class
class MockQuery {
  constructor(data, modelName) {
    this.data = data;
    this.modelName = modelName;
  }

  select(fields) {
    // Mock select fields subtraction (e.g. '-password')
    if (typeof fields === 'string' && fields.startsWith('-')) {
      const fieldToRemove = fields.substring(1);
      this.data = this.data.map(item => {
        const copy = { ...item };
        delete copy[fieldToRemove];
        return copy;
      });
    }
    return this;
  }

  populate(path, selectFields) {
    // If populating pharmacyId in Medicine model
    if (path === 'pharmacyId' && this.modelName === 'Medicine') {
      this.data = this.data.map(item => {
        const pharmacyIdStr = item.pharmacyId ? (item.pharmacyId._id || item.pharmacyId).toString() : null;
        if (pharmacyIdStr) {
          const pharm = mockDb.Pharmacy.find(p => p._id.toString() === pharmacyIdStr);
          if (pharm) {
            return {
              ...item,
              pharmacyId: { ...pharm }
            };
          }
        }
        return item;
      });
    }
    return this;
  }

  then(resolve, reject) {
    if (typeof resolve === 'function') {
      resolve(this.data);
    }
  }

  exec() {
    return Promise.resolve(this.data);
  }
}

// Mock Model class matching Mongoose Model API
class MockModel {
  constructor(modelName) {
    this.modelName = modelName;
  }

  find(query = {}) {
    let results = [...mockDb[this.modelName]];

    if (query && typeof query === 'object') {
      // Regex search for medicineName
      if (query.medicineName && query.medicineName.$regex) {
        const regex = new RegExp(query.medicineName.$regex, 'i');
        results = results.filter(item => regex.test(item.medicineName));
      }
    }

    return new MockQuery(results, this.modelName);
  }

  findOne(query = {}) {
    let results = [...mockDb[this.modelName]];

    if (query && typeof query === 'object') {
      // Check for email lookups
      if (query.email) {
        results = results.filter(item => item.email === query.email);
      }
      // Check for $or registers
      if (query.$or) {
        results = results.filter(item => {
          return query.$or.some(cond => {
            if (cond.email && item.email === cond.email) return true;
            if (cond.username && item.username === cond.username) return true;
            return false;
          });
        });
      }
    }

    const single = results[0] || null;
    return {
      then: (resolve) => {
        if (typeof resolve === 'function') resolve(single);
      },
      exec: () => Promise.resolve(single)
    };
  }

  findById(id) {
    const item = mockDb[this.modelName].find(x => x._id.toString() === id.toString()) || null;
    return {
      then: (resolve) => {
        if (typeof resolve === 'function') resolve(item);
      },
      exec: () => Promise.resolve(item)
    };
  }

  create(data) {
    const newItem = {
      _id: 'mock_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    mockDb[this.modelName].push(newItem);
    return Promise.resolve(newItem);
  }

  findByIdAndUpdate(id, data, options) {
    const idx = mockDb[this.modelName].findIndex(x => x._id.toString() === id.toString());
    if (idx === -1) {
      return Promise.resolve(null);
    }
    mockDb[this.modelName][idx] = {
      ...mockDb[this.modelName][idx],
      ...data,
      updatedAt: new Date().toISOString()
    };
    return Promise.resolve(mockDb[this.modelName][idx]);
  }

  findByIdAndDelete(id) {
    const idx = mockDb[this.modelName].findIndex(x => x._id.toString() === id.toString());
    if (idx === -1) {
      return Promise.resolve(null);
    }
    const deleted = mockDb[this.modelName].splice(idx, 1)[0];
    return Promise.resolve(deleted);
  }

  insertMany(arr) {
    const created = arr.map(data => ({
      _id: 'mock_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    }));
    mockDb[this.modelName].push(...created);
    return Promise.resolve(created);
  }
}

// Override Mongoose Compile function to return transparent fallback Proxies
const originalModel = mongoose.model.bind(mongoose);

mongoose.model = (name, schema) => {
  const realModel = originalModel(name, schema);
  const mockModel = new MockModel(name);

  return new Proxy(realModel, {
    get(target, prop, receiver) {
      // Use Mongo Atlas if connected
      if (mongoose.connection.readyState === 1) {
        return Reflect.get(target, prop, receiver);
      } else {
        // Redirect Mongoose Model method to Mock Engine
        if (typeof mockModel[prop] === 'function') {
          return mockModel[prop].bind(mockModel);
        }
        return Reflect.get(mockModel, prop);
      }
    }
  });
};

// Main Connection Handler
const connection = async () => {
  try {
    console.log('⏳ Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 4000 // Timeout early to switch to mock database quickly
    });
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.log('❌ Database Error:', err.message);
    console.log('⚠️ Running in-memory database mock mode instead.');
  }
};

module.exports = connection;