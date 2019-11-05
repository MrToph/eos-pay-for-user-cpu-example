import express from 'express';
import { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import BaseRouter from './routes';

// Init express
const app = express();

// Add middleware/settings/routes to express.
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use('/api', BaseRouter);

// Export express instance
export default app;
