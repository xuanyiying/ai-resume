export enum SubscriptionPlan {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum BillingPeriod {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export const SUBSCRIPTION_PLANS = {
  [SubscriptionPlan.FREE]: {
    name: 'Free',
    features: [
      'Basic Resume Parsing',
      'Standard Templates',
      '3 Optimizations / Month',
      'PDF Export (Watermarked)',
    ],
  },
  [SubscriptionPlan.PRO]: {
    name: 'Pro',
    features: [
      'Unlimited Parsing',
      'Premium Templates',
      'Unlimited Optimizations',
      'No Watermark',
      'Cover Letter Generation',
      'Priority Support',
    ],
  },
  [SubscriptionPlan.ENTERPRISE]: {
    name: 'Enterprise',
    features: [
      'Everything in Pro',
      'Custom Templates',
      'API Access',
      'Dedicated Account Manager',
      'SSO Integration',
    ],
  },
};
