import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api/user/userApi';
import { useAuthStore } from '../../store';
import { UserForm, FormInput, FormButton, ErrorMessage } from '../../components/user';
import Layout from '../../components/layout/Layout';
import { getActiveThemeColors } from '../../theme/theme';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await login({ username, password });
      setTokens(result.token, result.refreshToken);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/user/password-reset');
  };

  const handleArround = () => {
    navigate('/');
  };

  const handleSignUp = () => {
    navigate('/user/register');
  };

  const colors = getActiveThemeColors('light');

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px' }}>
        <img src={'/images/logo.png'} alt="늬웃 로고" style={{ width: '84px', height: '84px', marginBottom: '12px' }} />
        <p style={{ fontSize: '20px', marginBottom: '24px', color: colors.gray600 }}>당신이 알아야 할 뉴스, 가장 빠르게 요약해드려요</p>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <UserForm title="">
            <ErrorMessage message={error} />

            <FormInput
              type="text"
              placeholder="아이디/이메일"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <FormInput
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <FormButton
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </FormButton>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
              <FormButton
                onClick={handleSignUp}
                variant="text"
                fullWidth={false}
              >
                회원가입
              </FormButton>

              <FormButton
                onClick={handleForgotPassword}
                variant="text"
                fullWidth={false}
              >
                비밀번호 초기화
              </FormButton>
            </div>
            <FormButton
              onClick={handleArround}
              variant="text"
              fullWidth={false}
            >
              일단 둘러보기
            </FormButton>
          </UserForm>
        </div>
      </div>
    </Layout>
  );
};

export default LoginPage; 