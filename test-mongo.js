const path = require('path');
const nm = path.join(__dirname, 'node_modules');

// Quick MongoDB connection test
const mongoose = require(path.join(nm, 'mongoose'));
const dotenv = require(path.join(nm, 'dotenv'));
dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGODB_URI;
console.log('Testing connection...');

mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    console.log('✅ Connected!');
    
    // Test write operation
    try {
      const Test = mongoose.model('Test', new mongoose.Schema({ msg: String }));
      await Test.create({ msg: 'hello' });
      console.log('✅ Write works!');
      
      const result = await Test.findOne({ msg: 'hello' });
      console.log('✅ Read works!');
      
      await Test.deleteMany({});
      console.log('✅ Delete works!');
    } catch(e) {
      console.error('❌ Operation failed:', e.message);
      console.error(e.stack?.split('\n').slice(0,5).join('\n'));
    }
    
    await mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Connection failed:', err.message);
    console.error('Code:', err.code);
  });
