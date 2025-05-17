import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import handsRouter from './routes/hands.js';
import { processHandHistories } from './utils/parseHandHistory.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        console.log('Incoming request origin:', origin);
        const allowedOrigins = [
            'https://pokerhistory.netlify.app',
            'https://pokerhistory.pro',
            'http://pokerhistory.pro',
            'https://www.pokerhistory.pro',
            'http://www.pokerhistory.pro',
            'http://localhost:5173',
            'http://localhost:3000'
        ];
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            console.log('No origin provided, allowing request');
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) !== -1) {
            console.log('Origin allowed:', origin);
            callback(null, true);
        } else {
            console.log('Origin blocked:', origin);
            console.log('Allowed origins:', allowedOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/plain') {
            cb(null, true);
        } else {
            cb(new Error('Only .txt files are allowed'));
        }
    }
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Routes
app.use('/api/hands', handsRouter);

// File upload route
app.post('/api/hands/upload', upload.single('file'), async (req, res) => {
    try {
        console.log('Received upload request:', {
            file: req.file,
            body: req.body
        });

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (!req.body.username) {
            return res.status(400).json({ message: 'Username is required' });
        }

        console.log('Processing file:', {
            path: req.file.path,
            tournamentName: req.body.tournamentName,
            username: req.body.username
        });

        // Process the uploaded file
        const result = await processHandHistories(req.file.path, req.body.tournamentName, req.body.username);
        
        console.log('File processing result:', result);

        // Verify hands were saved
        const savedHands = await mongoose.connection.db.collection('hands').find({}).toArray();
        console.log('Total hands in database after import:', savedHands.length);
        if (savedHands.length > 0) {
            console.log('Sample hand:', JSON.stringify(savedHands[0], null, 2));
        }
        
        res.json({
            message: 'File processed successfully',
            stats: {
                totalHands: result.totalHands,
                handsPlayed: result.handsPlayed,
                handsSaved: result.handsSaved
            }
        });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ message: error.message || 'Error processing file' });
    }
});

// Create uploads directory if it doesn't exist
import fs from 'fs';
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 