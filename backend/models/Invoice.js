const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  description: String,
  hsnCode: String,
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  tax: { type: Number, default: 18 },
  serialNote: String
});

const InvoiceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoiceNumber: { type: String, required: true },
  // Company / Invoice Info
  invoiceDate: { type: Date, default: Date.now },
  gstNo: String,
  phoneNo: String,
  reverseCharge: String,
  stateName: String,
  stateCode: String,
  transportBy: String,
  vehicleNo: String,
  deliveryDate: Date,
  placeOfDelivery: String,
  discount: { type: Number, default: 0 },
  // Billed To
  customer: {
    name: String,
    trNo: String,
    address: String,
    gstNo: String,
    state: String,
    stateCode: String,
    email: String,
    phone: String,
  },
  // Shipped To
  consignee: {
    name: String,
    address: String,
    gstNo: String,
    stateCode: String,
  },
  issueDate: { type: Date, default: Date.now },
  dueDate: Date,
  status: { type: String, enum: ['draft','pending','paid','overdue','cancelled'], default: 'draft' },
  items: [ItemSchema],
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

// Virtuals
InvoiceSchema.virtual('subtotal').get(function() {
  return this.items.reduce((s,i) => s + i.quantity * i.unitPrice, 0);
});
InvoiceSchema.virtual('cgstTotal').get(function() {
  return this.items.reduce((s,i) => s + (i.quantity * i.unitPrice * 0.09), 0);
});
InvoiceSchema.virtual('sgstTotal').get(function() {
  return this.items.reduce((s,i) => s + (i.quantity * i.unitPrice * 0.09), 0);
});
InvoiceSchema.virtual('grandTotal').get(function() {
  const before = this.subtotal + this.cgstTotal + this.sgstTotal - (this.discount || 0);
  return Math.round(before);
});

InvoiceSchema.set('toJSON', { virtuals: true });
InvoiceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);