const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timestamp: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending', required: true },
  headName: String,
  parentName: String,
  village: String,
  inchargeName: String,
  address: String,
  age: String,
  phone: String,
  whatsapp: String,
  email: String,
  occupation: String,
  temple: String,
  familyMembers: mongoose.Schema.Types.Mixed
}, { strict: false });

module.exports = mongoose.model('Submission', submissionSchema);
