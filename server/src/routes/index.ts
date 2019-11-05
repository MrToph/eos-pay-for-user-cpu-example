import { Router } from 'express';
import SignatureRouter from './sign';

// Init router and path
const router = Router();

// Add sub-routes
router.use('/eos', SignatureRouter);

// Export the base-router
export default router;
