import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import chatRoute from './routes/chat.ts';

const app = express();
app.use(cors()); 
app.use(express.json({ limit: '1mb' }));
app.use('/api', chatRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Agentic chat listening on ${PORT}`));
