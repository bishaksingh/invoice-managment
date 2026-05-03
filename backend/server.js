const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ✅ Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ✅ FIX: Correct frontend path for Render
const frontendPath = path.join(__dirname, '../frontend');
// Serve static files
app.use(express.static(frontendPath));

// ✅ API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/invoices', require('./routes/invoices'));

// ✅ Frontend routes (Render safe)
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/invoices', (req, res) => {
  res.sendFile(path.join(frontendPath, 'invoice-list.html'));
});

app.get('/invoice', (req, res) => {
  res.sendFile(path.join(frontendPath, 'invoice-view.html'));
});

// ✅ OPTIONAL: fallback route (prevents "Not Found")
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

// ✅ MongoDB Connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ✅ PORT (Render compatible)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));