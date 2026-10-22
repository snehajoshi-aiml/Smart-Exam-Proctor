// backup.js - For backing up database
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const backupDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }

        const collections = await mongoose.connection.db.collections();
        
        for (const collection of collections) {
            const data = await collection.find({}).toArray();
            const fileName = `${collection.collectionName}_${Date.now()}.json`;
            const filePath = path.join(backupDir, fileName);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`Backed up ${collection.collectionName} to ${fileName}`);
        }

        await mongoose.connection.close();
        console.log('Database backup completed');
    } catch (error) {
        console.error('Error backing up database:', error);
        process.exit(1);
    }
};

backupDatabase();