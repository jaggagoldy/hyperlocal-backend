import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import logger from './config/logger.js';
import { requestId } from './middlewares/requestId.js';
import { errorHandler } from './errors/errorHandler.js';
import AppError from './errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import v1Router from './routes/v1/index.js';
import prisma from './config/prisma.js';
import { swaggerDocs } from './swagger.js';

const app = express();

// Set security HTTP headers
app.use(helmet());

// Protect against HTTP Parameter Pollution attacks
app.use(hpp());

// Compress response bodies
app.use(compression());

// Parse json request body with 100kb limit
app.use(express.json({ limit: '100kb' }));

// Parse urlencoded request body
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Global Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { status: 'fail', message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Enable CORS (allow dev frontend and Vercel prod)
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000'
    ].filter(Boolean);

    // Allow wildcard Vercel preview environments if needed, or strict FRONTEND_URL
    const isVercel = origin.endsWith('.vercel.app');
    
    if (allowedOrigins.includes(origin) || isVercel) {
      return callback(null, true);
    }
    
    return callback(new AppError(StatusCodes.FORBIDDEN, 'CORS Error: Origin not allowed by CORS'));
  },
  credentials: true
}));

// Attach UUID to request
app.use(requestId);

// Pino request logger
app.use(
  pinoHttp({
    logger,
    customProps: (req, res) => {
      return { reqId: req.id };
    },
  })
);

// Mount Swagger Docs
swaggerDocs(app);

// Resilient Health Check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'success', message: 'System operational', dependencies: { database: 'up' } });
  } catch (err) {
    logger.error(err, 'Database connection degraded');
    res.status(200).json({ status: 'degraded', message: 'System partially degraded', dependencies: { database: 'down' } });
  }
});

// API is strictly Headless: Static frontend files are no longer served from the backend.
// app.use(express.static('src/public'));

// v1 api routes
app.use('/api/v1', v1Router);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new AppError(StatusCodes.NOT_FOUND, 'Not found'));
});

// Global error handler
app.use(errorHandler);

export default app;
