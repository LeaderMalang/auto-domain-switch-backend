const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { switchDomainIfNeeded } = require('./controllers/autoDomainController');
const cron = require('node-cron');

dotenv.config();


connectDB();

const app = express();


app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.get('/', (req, res) => {
  res.send('Server is running successfully!');
});


cron.schedule('*/1 * * * *', async () => {
  console.log('[!] Running scheduled domain check...');
  await switchDomainIfNeeded();
})


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



// const express = require('express');
// const bodyParser = require('body-parser');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const connectDB = require('./config/db');


// // Load environment variables
// dotenv.config();

// // Connect to MongoDB
// connectDB();

// const app = express();

// // Middleware
// app.use(cors()); // Enable CORS
// app.use(bodyParser.json()); // Parse JSON bodies
// app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies

// // Routes
// app.use('/api', apiRoutes);

// // Default Route
// app.get('/', (req, res) => {
//   res.send('Server is running successfully!');
// });

// // Port Setup
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });
