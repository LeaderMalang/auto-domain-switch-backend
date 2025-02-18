const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

console.log("MONGO_URI",process.env.MONGO_URI)
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/myapp', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Database Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
