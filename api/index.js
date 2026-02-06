const express = require('express');
const app = express();

// Endpoint dasar
app.get('/', (req, res) => {
  res.send('Halo dari server SARAS (Sahabat Remaja Sehat)!');
});

// Ekspor app untuk Vercel
module.exports = app;
