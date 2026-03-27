import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function fix() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get the collection
    const collection = mongoose.connection.db.collection('users');
    
    // List indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);
    
    // Drop uid_1 if exists
    if (indexes.find(i => i.name === 'uid_1')) {
      await collection.dropIndex('uid_1');
      console.log('Dropped uid_1 index');
    } else {
        console.log('uid_1 index not found');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fix();
