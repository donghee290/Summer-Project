import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api/user/userApi';
import { useAuthStore } from '../../store';
import { UserForm, FormInput, FormButton, ErrorMessage } from '../../components/user';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await login({ username, password });
      setToken(result.token);
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

  const handleSignUp = () => {
    navigate('/user/register');
  };

  return (
    <UserForm title="늬웃">
      <ErrorMessage message={error} />
      
      <FormInput
        type="text"
        placeholder="아이디를 입력해주세요"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      
      <FormInput
        type="password"
        placeholder="비밀번호를 입력해주세요"
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
    </UserForm>
  );
};

export default LoginPage; 