import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../../api/user/userApi';
import { UserForm, FormInput, FormButton, ErrorMessage } from '../../components/user';

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!username || !password || !email) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register({ username, password, email });
      navigate('/user/login');
    } catch (err: any) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <UserForm title="회원가입">
      <ErrorMessage message={error} />
      
      <FormInput
        type="text"
        placeholder="아이디를 입력해주세요"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      
      <FormInput
        type="email"
        placeholder="이메일을 입력해주세요"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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
        onClick={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? '회원가입 중...' : '회원가입'}
      </FormButton>
      
      <FormButton
        onClick={() => navigate('/user/login')}
        variant="text"
      >
        로그인으로 돌아가기
      </FormButton>
    </UserForm>
  );
};

export default RegisterPage; 