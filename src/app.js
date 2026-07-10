import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import logger from './config/logger.js';
import { requestId } from './middlewares/requestId.js';
import { alertOn5xx } from './middlewares/alertOn5xx.js';
import { errorHandler } from './errors/errorHandler.js';
import AppError from './errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import v1Router from './routes/v1/index.js';
import prisma from './config/prisma.js';
import { dbMode, dbHost } from './config/dbMode.js';
import { swaggerDocs } from './swagger.js';

const app = express();

// Trust the first proxy hop (Render/Vercel) so req.protocol and client IPs
// (used for rate limiting and reset links) reflect X-Forwarded-* headers.
app.set('trust proxy', 1);

// Set security HTTP headers.
// The default CSP is extended so the frontend can load the CDN-hosted QR script,
// remote vendor images (Cloudinary/placeholders) and register the service worker.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", 'https://cdnjs.cloudflare.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", 'https:'],
        'worker-src': ["'self'"],
      },
    },
  })
);

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
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3005'
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

// Operational alerting: watch for a sustained 5xx error rate (RG-001 item 7).
// Attaches a response-finish hook; no-op unless an alert channel is configured.
app.use(alertOn5xx);

// Mount Swagger Docs
swaggerDocs(app);

// Root Health Probe
app.get('/', (req, res) => {
  res.status(200).json({ message: 'NearByBazar API Engine Live' });
});

// Resilient Health Check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'success', message: 'NearByBazar API Engine Live', dependencies: { database: 'up' }, dbMode });
  } catch (err) {
    logger.error(err, 'Database connection degraded');
    res.status(200).json({ status: 'degraded', message: 'System partially degraded', dependencies: { database: 'down' }, dbMode });
  }
});

// Lightweight meta endpoint (under the API prefix so the frontend can reach it
// with its existing base URL). Surfaces the coarse DB mode only — no credentials.
app.get('/api/v1/meta', (req, res) => {
  res.status(200).json({ dbMode, dbHost, env: process.env.NODE_ENV || 'development' });
});

// Serve static frontend files (HTML, CSS, JS, assets)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// Business Storefront Page — public route for each vendor's mini-site
app.get('/s/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'storefront.html'));
});

// Platform Updates / "What's New" — public release history page
app.get('/whats-new', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'whats-new.html'));
});

// v1 api routes
app.use('/api/v1', v1Router);

// ── Customer Discovery (Sprint 2 · Batch 1) ────────────────────────────────
// One discovery engine, several entry points. /discover is the canonical page;
// /c/:categorySlug, /l/:locality and /:district/:category are SEO-friendly
// aliases that serve the exact same discovery.html shell with a clean,
// crawlable URL. discovery.js reads whichever path it booted from and derives
// the initial filter state (category / locality / district) from it, then
// treats all of them as the same filter object internally — no separate
// implementation per entry point. Declared after the /api/v1 mount (and after
// static assets, /s/:slug, /whats-new above) so nothing else can ever be
// shadowed by the broad two-segment :district/:category wildcard.
//
// Ordering matters: /business/:slug is also a two-segment path, so it MUST be
// declared before the generic /:district/:category wildcard below it, or the
// wildcard would swallow it first (Express matches in registration order).
app.get('/business/:slug', (req, res) => {
  res.redirect(301, `/s/${req.params.slug}`);
});

const serveDiscovery = (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'discovery.html'));
};
app.get('/discover', serveDiscovery);
app.get('/c/:categorySlug', serveDiscovery);
app.get('/l/:locality', serveDiscovery);
app.get('/:district/:category', serveDiscovery);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new AppError(StatusCodes.NOT_FOUND, 'Not found'));
});

// Global error handler
app.use(errorHandler);

export default app;
