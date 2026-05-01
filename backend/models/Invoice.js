const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  description: String,
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  tax: { type: Number, default: 0 } // percentage
});

const InvoiceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoiceNumber: { type: String, required: true },
  customer: {
    name: String,
    email: String,
    phone: String,
    address: String
  },
  issueDate: { type: Date, default: Date.now },
  dueDate: Date,
  status: {
    type: String,
    enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  items: [ItemSchema],
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

// Virtual for subtotal
InvoiceSchema.virtual('subtotal').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
});

// Virtual for total tax
InvoiceSchema.virtual('totalTax').get(function () {
  return this.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.tax) / 100, 0);
});

// Virtual for grand total
InvoiceSchema.virtual('grandTotal').get(function () {
  return this.subtotal + this.totalTax;
});

InvoiceSchema.set('toJSON', { virtuals: true });
InvoiceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);