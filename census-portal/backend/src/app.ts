import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';

import publicRoutes from './routes/public';
import authRoutes from './routes/auth';
import protectedRoutes from './routes/protected';
import analyticsRoutes from './routes/analytics';
import adminRoutes from './routes/admin';
import { errorHandler, notFoundHandler } from './middleware/error';

export function buildApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('tiny'));

  app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'census-portal' }));

  // ============================================================
  // ROUTES
  // ============================================================

  // 1. Public routes - NO API KEY REQUIRED
  app.use('/api/v1/public', publicRoutes);

  // 2. Authentication routes - NO API KEY REQUIRED
  app.use('/api/v1/auth', authRoutes);

  // 3. Protected routes - API KEY REQUIRED (key management is JWT-gated within)
  app.use('/api/v1/protected', protectedRoutes);

  // 4. Analytics routes - API KEY REQUIRED. Not surfaced in the Data
  // Explorer UI, but available for NGO developers to build on directly.
  app.use('/api/v1/analytics', analyticsRoutes);

  // 5. Admin routes - JWT + ADMIN role required
  app.use('/api/v1/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}