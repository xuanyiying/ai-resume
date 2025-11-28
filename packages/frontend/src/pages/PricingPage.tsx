import React, { useState } from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  Typography,
  List,
  message,
  Switch,
  Tag,
} from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { paymentService } from '../services/payment.service';

const { Title, Text } = Typography;

const PricingPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const { user } = useAuthStore();

  const handleUpgrade = async (priceId: string) => {
    if (!user) {
      message.warning('Please log in to upgrade your plan');
      return;
    }

    setLoading(true);
    try {
      const { url } = await paymentService.createCheckoutSession(priceId);
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Failed to start checkout session:', error);
      message.error('Failed to start payment process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPriceId = (tier: string) => {
    if (tier === 'Pro') {
      return isYearly
        ? import.meta.env.VITE_STRIPE_PRICE_PRO_YEARLY
        : import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY;
    }
    if (tier === 'Enterprise') {
      return isYearly
        ? import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE_YEARLY
        : import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE_MONTHLY;
    }
    return '';
  };

  const tiers = [
    {
      title: 'Free',
      price: '$0',
      period: isYearly ? '/year' : '/month',
      features: [
        'Basic Resume Parsing',
        'Standard Templates',
        '3 Optimizations / Month',
        'PDF Export (Watermarked)',
      ],
      buttonText: 'Current Plan',
      isCurrent: user?.subscriptionTier === 'FREE',
      action: null,
    },
    {
      title: 'Pro',
      price: isYearly ? '$190' : '$19',
      period: isYearly ? '/year' : '/month',
      save: isYearly ? 'Save 17%' : null,
      features: [
        'Unlimited Parsing',
        'Premium Templates',
        'Unlimited Optimizations',
        'No Watermark',
        'Cover Letter Generation',
        'Priority Support',
      ],
      buttonText: 'Upgrade to Pro',
      isCurrent: user?.subscriptionTier === 'PRO',
      action: () => handleUpgrade(getPriceId('Pro')),
      popular: true,
    },
    {
      title: 'Enterprise',
      price: isYearly ? '$990' : '$99',
      period: isYearly ? '/year' : '/month',
      save: isYearly ? 'Save 17%' : null,
      features: [
        'Everything in Pro',
        'Custom Templates',
        'API Access',
        'Dedicated Account Manager',
        'SSO Integration',
      ],
      buttonText: 'Contact Sales', // Or Upgrade if self-serve
      isCurrent: user?.subscriptionTier === 'ENTERPRISE',
      action: () => handleUpgrade(getPriceId('Enterprise')),
    },
  ];

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <Title level={1}>Simple, Transparent Pricing</Title>
        <Text
          type="secondary"
          style={{ fontSize: 18, display: 'block', marginBottom: 24 }}
        >
          Choose the plan that best fits your career goals.
        </Text>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <Text strong={!isYearly}>Monthly</Text>
          <Switch checked={isYearly} onChange={setIsYearly} />
          <Text strong={isYearly}>
            Yearly <Tag color="green">Save ~17%</Tag>
          </Text>
        </div>
      </div>

      <Row gutter={[32, 32]} justify="center">
        {tiers.map((tier) => (
          <Col xs={24} md={8} key={tier.title}>
            <Card
              hoverable
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderColor: tier.popular ? '#1890ff' : undefined,
                borderWidth: tier.popular ? 2 : 1,
                position: 'relative',
              }}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              {tier.popular && (
                <Tag
                  color="#1890ff"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    borderTopLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  }}
                >
                  MOST POPULAR
                </Tag>
              )}

              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Title level={3}>{tier.title}</Title>
                <div style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 36, fontWeight: 'bold' }}>
                    {tier.price}
                  </Text>
                  <Text type="secondary">{tier.period}</Text>
                </div>
              </div>

              <List
                dataSource={tier.features}
                renderItem={(item) => (
                  <List.Item style={{ border: 'none', padding: '8px 0' }}>
                    <CheckOutlined
                      style={{ color: '#52c41a', marginRight: 8 }}
                    />
                    {item}
                  </List.Item>
                )}
                style={{ marginBottom: 32, flex: 1 }}
              />

              <Button
                type={tier.popular ? 'primary' : 'default'}
                size="large"
                block
                onClick={tier.action || undefined}
                disabled={tier.isCurrent || !tier.action}
                loading={loading && !tier.isCurrent && !!tier.action}
              >
                {tier.isCurrent ? 'Current Plan' : tier.buttonText}
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default PricingPage;
