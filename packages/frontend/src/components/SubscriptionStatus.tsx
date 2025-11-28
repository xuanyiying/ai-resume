import React from 'react';
import { Tag, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';

interface SubscriptionStatusProps {
  tier: string;
  status?: string;
  expiresAt?: string | Date;
  cancelAtPeriodEnd?: boolean;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  tier,
  status,
  expiresAt,
  cancelAtPeriodEnd,
}) => {
  const getStatusColor = () => {
    if (status === 'active') return 'success';
    if (status === 'past_due') return 'warning';
    if (status === 'canceled') return 'error';
    return 'default';
  };

  const formatDate = (date: string | Date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Tag
        color={
          tier === 'PRO' ? 'blue' : tier === 'ENTERPRISE' ? 'purple' : 'default'
        }
      >
        {tier}
      </Tag>

      {status && (
        <Tag
          icon={
            status === 'active' ? (
              <CheckCircleOutlined />
            ) : (
              <ClockCircleOutlined />
            )
          }
          color={getStatusColor()}
        >
          {status.toUpperCase()}
        </Tag>
      )}

      {cancelAtPeriodEnd && (
        <Tooltip title={`Access until ${formatDate(expiresAt!)}`}>
          <Tag icon={<SyncOutlined spin={false} />} color="warning">
            CANCELING
          </Tag>
        </Tooltip>
      )}
    </div>
  );
};

export default SubscriptionStatus;
