import React from 'react';
import { Result, Button, Card } from 'antd';
import { useNavigate } from 'react-router-dom';

const PaymentCancelPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '40px 20px', maxWidth: 800, margin: '0 auto' }}>
      <Card>
        <Result
          status="warning"
          title="Payment Canceled"
          subTitle="Your payment process was canceled. No charges were made."
          extra={[
            <Button
              type="primary"
              key="pricing"
              onClick={() => navigate('/pricing')}
            >
              Return to Pricing
            </Button>,
            <Button key="dashboard" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>,
          ]}
        />
      </Card>
    </div>
  );
};

export default PaymentCancelPage;
