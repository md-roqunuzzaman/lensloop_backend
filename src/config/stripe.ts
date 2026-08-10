import Stripe from 'stripe';
import { env } from './env';

export const stripe = new Stripe(env.stripe.secretKey || 'sk_test_placeholder', {
  apiVersion: '2024-06-20',
});
