import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { paymentController } from './modules/payment/payment.controller';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
);
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(cookieParser());

// Stripe webhook needs the raw request body for signature verification, so
// it must be registered BEFORE the global express.json() parser below.
app.post('/api/payments/webhook/stripe', express.raw({ type: 'application/json' }), paymentController.stripeWebhook);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve locally uploaded gear/avatar images.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'gearup-api', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
