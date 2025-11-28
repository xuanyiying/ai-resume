import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Button,
  Table,
  Tag,
  Modal,
  message,
  Descriptions,
  Space,
} from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import {
  paymentService,
  SubscriptionDetails,
  BillingRecord,
} from '../services/payment.service';
import SubscriptionStatus from '../components/SubscriptionStatus';

const { Title, Text } = Typography;
const { confirm } = Modal;

const SubscriptionManagementPage: React.FC = () => {
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(
    null
  );
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subData, billingData] = await Promise.all([
        paymentService.getUserSubscription(),
        paymentService.getBillingHistory(),
      ]);
      setSubscription(subData);
      setBillingHistory(billingData);
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
      message.error('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCancelSubscription = () => {
    confirm({
      title: 'Are you sure you want to cancel?',
      icon: <ExclamationCircleOutlined />,
      content:
        'Your subscription will remain active until the end of the current billing period. After that, you will lose access to Pro features.',
      okText: 'Yes, Cancel Subscription',
      okType: 'danger',
      cancelText: 'No, Keep It',
      onOk: async () => {
        try {
          setCanceling(true);
          await paymentService.cancelSubscription();
          message.success('Subscription canceled successfully');
          fetchData(); // Refresh data
        } catch (error) {
          console.error('Failed to cancel subscription:', error);
          message.error('Failed to cancel subscription');
        } finally {
          setCanceling(false);
        }
      },
    });
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: BillingRecord) =>
        `${amount.toFixed(2)} ${record.currency.toUpperCase()}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'paid' ? 'success' : 'error'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Invoice',
      key: 'action',
      render: (_: any, record: BillingRecord) => (
        <a href={record.pdfUrl} target="_blank" rel="noopener noreferrer">
          Download PDF
        </a>
      ),
    },
  ];

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1000, margin: '0 auto' }}>
      <Title level={2}>Subscription Management</Title>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="Current Subscription" loading={loading}>
          {subscription ? (
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Plan">
                <SubscriptionStatus
                  tier={subscription.tier}
                  status={subscription.status}
                  expiresAt={subscription.expiresAt}
                  cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {subscription.status === 'active' ? 'Active' : 'Inactive'}
              </Descriptions.Item>
              {subscription.currentPeriodEnd && (
                <Descriptions.Item label="Current Period Ends">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </Descriptions.Item>
              )}
            </Descriptions>
          ) : (
            <Text>No active subscription found.</Text>
          )}

          {subscription?.status === 'active' &&
            !subscription.cancelAtPeriodEnd && (
              <div style={{ marginTop: 24 }}>
                <Button
                  danger
                  onClick={handleCancelSubscription}
                  loading={canceling}
                >
                  Cancel Subscription
                </Button>
              </div>
            )}
        </Card>

        <Card title="Billing History" loading={loading}>
          <Table
            dataSource={billingHistory}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 5 }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default SubscriptionManagementPage;
