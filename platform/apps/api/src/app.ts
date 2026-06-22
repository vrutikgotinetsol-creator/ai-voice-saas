import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { corsOrigins } from './config/env';
import { globalRateLimit, webhookRateLimit } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import adminRoutes from './routes/admin/clients.routes';
import clientRoutes from './routes/client/me.routes';
import billingRoutes, { stripeWebhookHandler } from './routes/billing/billing.routes';
import vapiRoutes from './routes/webhooks/vapi.routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));

  // Stripe webhook needs raw body — mount BEFORE json parser
  app.post('/webhook/stripe', express.raw({ type: 'application/json' }), webhookRateLimit, stripeWebhookHandler);

  app.use(express.json({ limit: '2mb' }));
  app.use(globalRateLimit);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Platform admin API
  app.use('/api/admin', adminRoutes);

  // Client (business owner) API
  app.use('/api/client', clientRoutes);

  // Billing
  app.use('/api/billing', billingRoutes);

  // Webhooks (Vapi)
  app.use('/webhook', webhookRateLimit, vapiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
