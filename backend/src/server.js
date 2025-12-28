const express = require('express');
const cors = require('cors');
const db = require('./db/db');

const authRoutes = require('./routes/auth');
const hkRoutes = require('./routes/housekeeping');
const maintenanceRoutes = require('./routes/maintenance');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/housekeeping', hkRoutes);
app.use('/api/maintenance', maintenanceRoutes);

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
