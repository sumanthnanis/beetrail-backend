require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const { check, validationResult, query } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { Parser } = require('json2csv');

const app = express();


app.use(express.json());
app.use(morgan('dev'));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

const hiveSchema = new mongoose.Schema({
  hiveId: { type: String, required: true, unique: true },
  datePlaced: { type: Date, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  numColonies: { type: Number, required: true },
  dateCreated: { type: Date, default: Date.now }
});
const Hive = mongoose.model('Hive', hiveSchema);

const cropSchema = new mongoose.Schema({
    name: { type: String, required: true },
    floweringStart: { type: Date, required: true },
    floweringEnd: { type: Date, required: true },
    recommendedHiveDensity: { type: Number, required: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], 
        required: true
      }
    },
    dateCreated: { type: Date, default: Date.now }
  });
  
  
  cropSchema.index({ location: '2dsphere' });
  
  const Crop = mongoose.model('Crop', cropSchema);
  


const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['beekeeper', 'admin'], required: true }
});
const User = mongoose.model('User', userSchema);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
 
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};


const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};



const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BeeTrail Backend API',
      version: '1.0.0',
      description: 'API Documentation for the BeeTrail Backend Service'
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      bearerAuth: []
    }],
  },
  apis: ['./server.js'], 
};

const swaggerSpecs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

/**
 * @swagger
 * components:
 *   schemas:
 *     Hive:
 *       type: object
 *       required:
 *         - hiveId
 *         - datePlaced
 *         - latitude
 *         - longitude
 *         - numColonies
 *       properties:
 *         hiveId:
 *           type: string
 *         datePlaced:
 *           type: string
 *           format: date
 *         latitude:
 *           type: number
 *         longitude:
 *           type: number
 *         numColonies:
 *           type: number
 *         dateCreated:
 *           type: string
 *           format: date-time
 *     Crop:
 *       type: object
 *       required:
 *         - name
 *         - floweringStart
 *         - floweringEnd
 *         - recommendedHiveDensity
 *         - latitude
 *         - longitude
 *       properties:
 *         name:
 *           type: string
 *         floweringStart:
 *           type: string
 *           format: date
 *         floweringEnd:
 *           type: string
 *           format: date
 *         recommendedHiveDensity:
 *           type: number
 *         latitude:
 *           type: number
 *         longitude:
 *           type: number
 *         dateCreated:
 *           type: string
 *           format: date-time
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - password
 *         - role
 *       properties:
 *         username:
 *           type: string
 *         password:
 *           type: string
 *         role:
 *           type: string
 *           enum:
 *             - beekeeper
 *             - admin
 */

/* ============================
   Authentication Routes
============================= */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User registered successfully.
 *       400:
 *         description: Bad request.
 */
app.post('/auth/register', [
  check('username').notEmpty(),
  check('password').isLength({ min: 6 }),
  check('role').isIn(['beekeeper', 'admin'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()){
    return res.status(400).json({ errors: errors.array() });
  }
  const { username, password, role } = req.body;
  try {
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({ username, password: hashedPassword, role });
    await user.save();
    return res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and obtain a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful.
 *       400:
 *         description: Invalid credentials.
 */
app.post('/auth/login', [
  check('username').notEmpty(),
  check('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()){
    return res.status(400).json({ errors: errors.array() });
  }
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
   
    const payload = {
      id: user._id,
      username: user.username,
      role: user.role,
      syncToken: Date.now() 
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token, syncToken: payload.syncToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});



/**
 * @swagger
 * /api/hives:
 *   post:
 *     summary: Add a new hive log.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Hive'
 *     responses:
 *       201:
 *         description: Hive log added successfully.
 *       400:
 *         description: Invalid input or duplicate hiveId.
 */
app.post('/api/hives', authenticateToken, [
  check('hiveId').notEmpty(),
  check('datePlaced').isISO8601(),
  check('latitude').isFloat({ min: -90, max: 90 }),
  check('longitude').isFloat({ min: -180, max: 180 }),
  check('numColonies').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()){
    return res.status(400).json({ errors: errors.array() });
  }
  const { hiveId, datePlaced, latitude, longitude, numColonies } = req.body;
  try {
    
    const existingHive = await Hive.findOne({ hiveId });
    if (existingHive) {
      return res.status(400).json({ error: 'hiveId must be unique' });
    }
    const hive = new Hive({
      hiveId,
      datePlaced: new Date(datePlaced),
      latitude,
      longitude,
      numColonies
    });
    await hive.save();
    return res.status(201).json({ message: 'Hive log added successfully', hive });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/hives:
 *   get:
 *     summary: Retrieve hive logs with optional date filtering.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter hives placed after this date.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter hives placed before this date.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results per page.
 *     responses:
 *       200:
 *         description: A paginated list of hive logs.
 */
app.get('/api/hives', authenticateToken, async (req, res) => {
  let { startDate, endDate, page, limit } = req.query;
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;
  const queryObj = {};
  if (startDate) {
    queryObj.datePlaced = { $gte: new Date(startDate) };
  }
  if (endDate) {
    queryObj.datePlaced = queryObj.datePlaced || {};
    queryObj.datePlaced.$lte = new Date(endDate);
  }
  try {
    const hives = await Hive.find(queryObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ datePlaced: -1 });
    const count = await Hive.countDocuments(queryObj);
    return res.json({ hives, total: count, page, pages: Math.ceil(count / limit) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});


/**
 * @swagger
 * /api/crops:
 *   post:
 *     summary: Add a crop calendar entry.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               floweringStart:
 *                 type: string
 *                 format: date
 *               floweringEnd:
 *                 type: string
 *                 format: date
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               recommendedHiveDensity:
 *                 type: number
 *     responses:
 *       201:
 *         description: Crop entry added successfully.
 *       400:
 *         description: Invalid input.
 */
app.post('/api/crops', authenticateToken, [
  check('name').notEmpty(),
  check('floweringStart').isISO8601(),
  check('floweringEnd').isISO8601(),
  check('latitude').isFloat({ min: -90, max: 90 }),
  check('longitude').isFloat({ min: -180, max: 180 }),
  check('recommendedHiveDensity').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()){
    return res.status(400).json({ errors: errors.array() });
  }
  let { name, floweringStart, floweringEnd, latitude, longitude, recommendedHiveDensity } = req.body;
  if(new Date(floweringStart) >= new Date(floweringEnd)){
    return res.status(400).json({ error: 'floweringStart must be before floweringEnd' });
  }
  try {
    const crop = new Crop({
      name,
      floweringStart: new Date(floweringStart),
      floweringEnd: new Date(floweringEnd),
      recommendedHiveDensity,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      }
    });
    await crop.save();
    return res.status(201).json({ message: 'Crop entry added successfully', crop });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/crops/nearby:
 *   get:
 *     summary: Get nearby crop opportunities.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 100
 *         description: Radius in km.
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           default: today
 *         description: Date to check flowering window.
 *     responses:
 *       200:
 *         description: List of nearby crops.
 */
app.get('/api/crops/nearby', authenticateToken, [
  query('latitude').exists().isFloat({ min: -90, max: 90 }),
  query('longitude').exists().isFloat({ min: -180, max: 180 }),
  query('radius').optional().isFloat({ min: 1 }),
  query('date').optional().isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()){
    return res.status(400).json({ errors: errors.array() });
  }
  let { latitude, longitude, radius, date } = req.query;
  latitude = parseFloat(latitude);
  longitude = parseFloat(longitude);
  radius = parseFloat(radius) || 100;
  const queryDate = date ? new Date(date) : new Date();
  try {
    const crops = await Crop.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: radius * 1000 
        }
      },
      floweringStart: { $lte: queryDate },
      floweringEnd: { $gte: queryDate }
    });
    if (crops.length === 0) {
      return res.status(200).json({ message: 'No crops found nearby for the given date', crops: [] });
    }
    return res.json({ crops });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});


/**
 * @swagger
 * /export/hives:
 *   get:
 *     summary: Export hive logs as CSV.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file of hive logs.
 *       403:
 *         description: Admin access required.
 */
app.get('/export/hives', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const hives = await Hive.find({});
    const fields = ['hiveId', 'datePlaced', 'latitude', 'longitude', 'numColonies', 'dateCreated'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(hives);
    res.header('Content-Type', 'text/csv');
    res.attachment('hive_logs.csv');
    return res.send(csv);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /export/crops:
 *   get:
 *     summary: Export crop entries as CSV.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file of crop entries.
 *       403:
 *         description: Admin access required.
 */
app.get('/export/crops', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const crops = await Crop.find({});
    const data = crops.map(crop => ({
      name: crop.name,
      floweringStart: crop.floweringStart,
      floweringEnd: crop.floweringEnd,
      recommendedHiveDensity: crop.recommendedHiveDensity,
      latitude: crop.location.coordinates[1],
      longitude: crop.location.coordinates[0],
      dateCreated: crop.dateCreated
    }));
    const fields = ['name', 'floweringStart', 'floweringEnd', 'recommendedHiveDensity', 'latitude', 'longitude', 'dateCreated'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment('crop_entries.csv');
    return res.send(csv);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});


/**
 * @swagger
 * /sync:
 *   get:
 *     summary: Get a sync token for offline synchronization.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync token with a timestamp.
 */
app.get('/sync', authenticateToken, (req, res) => {
  const syncToken = Date.now(); // New sync token based on the current timestamp
  res.json({ syncToken });
});


app.get('/admin', authenticateToken, requireAdmin, (req, res) => {
  res.send(`
    <h1>Admin Dashboard</h1>
    <ul>
      <li><a href="/export/hives">Export Hive Logs CSV</a></li>
      <li><a href="/export/crops">Export Crop Entries CSV</a></li>
      <li><a href="/api-docs">API Documentation</a></li>
    </ul>
  `);
});



app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
