import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { message, Spin, Typography } from 'antd';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/authService';

const { Title } = Typography;

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get token from URL query parameters
        const urlParams = new URLSearchParams(location.search);
        const token = urlParams.get('token');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(decodeURIComponent(error));
        }

        if (!token) {
          throw new Error('认证失败：未收到访问令牌');
        }

        // Verify the token and get user info
        const user = await authService.verifyToken(token);

        // Set auth state
        setAuth(user, token);

        message.success('登录成功！');

        // Redirect to home page
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
      } catch (err) {
        const errorMessage =
          (err as Error)?.message || 'OAuth 认证失败，请重试';

        message.error(errorMessage);

        // Redirect to login page after a short delay
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    };

    handleOAuthCallback();
  }, [location, navigate, setAuth]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
      }}
    >
      <Spin size="large" />
      <Title level={3} style={{ color: '#fff', marginTop: '20px' }}>
        正在处理认证...
      </Title>
    </div>
  );
};

export default OAuthCallbackPage;
