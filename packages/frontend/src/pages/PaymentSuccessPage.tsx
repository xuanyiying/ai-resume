import React, { useEffect, useState } from 'react';
import { Result, Button, Typography, Card, Spin } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircleOutlined } from '@ant-design/icons';
import { paymentService } from '../services/payment.service';
import { useAuthStore } from '../stores/authStore';

const { Paragraph, Text } = Typography;

const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const { refreshProfile } = useAuthStore();

  useEffect(() => {
    const verifySubscription = async () => {
      try {
        // Wait a moment for webhook to process
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await refreshProfile();
      } catch (error) {
        console.error('Failed to refresh profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId || searchParams.get('mock')) {
      verifySubscription();
    } else {
      setLoading(false);
    }
  }, [sessionId, refreshProfile, searchParams]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" tip="Verifying your subscription..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: 800, margin: '0 auto' }}>
      <Card>
        <Result
          status="success"
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          title="Payment Successful!"
          subTitle="Thank you for upgrading to Pro. Your subscription is now active."
          extra={[
            <Button
              type="primary"
              key="dashboard"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </Button>,
            <Button
              key="subscription"
              onClick={() => navigate('/subscription')}
            >
              Manage Subscription
            </Button>,
          ]}
        >
          <div style={{ textAlign: 'center' }}>
            <Paragraph>
              <Text strong>Order ID:</Text> {sessionId || 'MOCK-SESSION-ID'}
            </Paragraph>
            <Paragraph>
              You now have access to all Pro features including unlimited
              optimizations and premium templates.
            </Paragraph>
          </div>
        </Result>
      </Card>
    </div>
  );
};

export default PaymentSuccessPage;
