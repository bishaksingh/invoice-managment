const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const authMiddleware = require('../middleware/auth');

// All routes protected
router.use(authMiddleware);

// GET all invoices for user
router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single invoice
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create invoice
router.post('/', async (req, res) => {
  try {
    const count = await Invoice.countDocuments({ userId: req.user.id });
    const invoiceNumber = `INV/${new Date().getFullYear()}/${String(count + 1).padStart(4, '0')}`;

    const invoice = await Invoice.create({
      ...req.body,
      userId: req.user.id,
      invoiceNumber
    });
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update invoice
router.put('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE invoice
router.delete('/:id', async (req, res) => {
  try {
    await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH update status
router.patch('/:id/status', async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { status: req.body.status },
      { new: true }
    );
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;