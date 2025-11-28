import axios from '../config/axios';

export interface SubscriptionDetails {
  tier: string;
  status?: string;
  expiresAt?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
}

export interface BillingRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  pdfUrl: string;
}

export const paymentService = {
  createCheckoutSession: async (priceId: string) => {
    const response = await axios.post('/payments/create-checkout-session', {
      priceId,
    });
    return response.data;
  },

  getUserSubscription: async (): Promise<SubscriptionDetails> => {
    const response = await axios.get('/payments/subscription');
    return response.data;
  },

  cancelSubscription: async () => {
    const response = await axios.post('/payments/cancel-subscription');
    return response.data;
  },

  getBillingHistory: async (): Promise<BillingRecord[]> => {
    const response = await axios.get('/payments/billing-history');
    return response.data;
  },
};
