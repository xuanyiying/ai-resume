import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier } from '@prisma/client';

@Injectable()
export class PaymentService {
  private readonly stripe: Stripe | null = null;
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    const stripeKey = this.configService.get('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2025-02-24.acacia',
      });
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY not found. Payment features will be disabled.'
      );
    }
  }

  async createCheckoutSession(userId: string, priceId: string) {
    if (!this.stripe) {
      // Mock for development if no key provided
      this.logger.log(
        `Mocking checkout session for user ${userId} with price ${priceId}`
      );
      return {
        url: `${this.configService.get('FRONTEND_URL')}/payment/success?mock=true`,
      };
    }

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new BadRequestException('User not found');

      let customerId = user.stripeCustomerId;

      // Create Stripe customer if not exists
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          metadata: { userId },
        });
        customerId = customer.id;
        await this.prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId },
        });
      }

      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${this.configService.get('FRONTEND_URL')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.configService.get('FRONTEND_URL')}/payment/cancel`,
        client_reference_id: userId,
        metadata: {
          userId,
        },
        allow_promotion_codes: true,
      });

      return { url: session.url };
    } catch (error: any) {
      this.logger.error(`Failed to create checkout session: ${error.message}`);
      throw new BadRequestException(
        `Payment initialization failed: ${error.message}`
      );
    }
  }

  async getUserSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        subscriptionExpiresAt: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
      },
    });

    if (!user) throw new BadRequestException('User not found');

    let subscriptionDetails: {
      status: Stripe.Subscription.Status;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: Date;
    } | null = null;

    if (this.stripe && user.stripeSubscriptionId) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(
          user.stripeSubscriptionId
        );
        subscriptionDetails = {
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        };
      } catch (error) {
        this.logger.error(`Failed to fetch subscription from Stripe: ${error}`);
      }
    }

    return {
      tier: user.subscriptionTier,
      expiresAt: user.subscriptionExpiresAt,
      ...subscriptionDetails,
    };
  }

  async cancelSubscription(userId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription found');
    }

    try {
      await this.stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      return {
        message:
          'Subscription will be canceled at the end of the billing period',
      };
    } catch (error: any) {
      this.logger.error(`Failed to cancel subscription: ${error.message}`);
      throw new BadRequestException(`Cancellation failed: ${error.message}`);
    }
  }

  async getBillingHistory(userId: string) {
    if (!this.stripe) return [];

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.stripeCustomerId) return [];

    try {
      const invoices = await this.stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit: 10,
      });

      return invoices.data.map((invoice) => ({
        id: invoice.id,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        status: invoice.status,
        date: new Date(invoice.created * 1000),
        pdfUrl: invoice.hosted_invoice_url,
      }));
    } catch (error: any) {
      this.logger.error(`Failed to fetch billing history: ${error.message}`);
      return [];
    }
  }

  async handleWebhook(signature: string, payload: Buffer) {
    if (!this.stripe) {
      this.logger.log('Webhook received (Mock mode)');
      return { received: true };
    }

    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook secret is not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
    } catch (err: any) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`
      );
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    this.logger.log(`Processing webhook event: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription
          );
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription
          );
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Error processing webhook event ${event.type}: ${error.message}`
      );
      // Don't throw error to Stripe to avoid retries for logic errors
    }

    return { received: true };
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session
  ) {
    const userId = session.client_reference_id;
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    if (!userId) {
      this.logger.warn('Checkout session missing client_reference_id');
      return;
    }

    this.logger.log(`Checkout completed for user ${userId}`);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionTier: SubscriptionTier.PRO, // Default to PRO, logic can be enhanced to check price ID
        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Initial 30 days
      },
    });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) return;

    const status = subscription.status;
    const expiresAt = new Date(subscription.current_period_end * 1000);

    // Determine tier based on logic or metadata (simplified here)
    let tier = user.subscriptionTier;
    if (status === 'active' || status === 'trialing') {
      // Keep current tier or update if needed based on plan ID
    } else if (
      status === 'past_due' ||
      status === 'unpaid' ||
      status === 'canceled'
    ) {
      // Handle non-active states if necessary
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionExpiresAt: expiresAt,
        stripeSubscriptionId: subscription.id,
      },
    });

    this.logger.log(
      `Updated subscription for user ${user.id}, status: ${status}`
    );
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) return;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: SubscriptionTier.FREE,
        subscriptionExpiresAt: null,
        stripeSubscriptionId: null,
      },
    });

    this.logger.log(`Subscription deleted for user ${user.id}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (user) {
      this.logger.warn(`Payment failed for user ${user.id}`);
      // Could send email notification here
    }
  }
}
