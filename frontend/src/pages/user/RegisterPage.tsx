import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, checkDuplicateId } from '../../api/user/userApi';
import { UserForm, FormInput, FormButton, ErrorMessage, SuccessMessage } from '../../components/user';

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [dupCheckMessage, setDupCheckMessage] = useState<string>('');
  const [isIdAvailable, setIsIdAvailable] = useState<boolean | null>(null);

  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!username || !password || !email) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (isIdAvailable !== true) {
      setError('아이디 중복 확인을 먼저 진행해주세요.');
      alert('아이디 중복 확인을 먼저 진행해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register({ username, password, email });
      alert('회원가입이 완료되었습니다.');
      navigate('/user/login');
    } catch (err: any) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckDuplicate = async () => {
    setError('');
    setDupCheckMessage('');
    setIsIdAvailable(null);
    if (!username) {
      setError('아이디를 입력해주세요.');
      return;
    }
    try {
      const { available } = await checkDuplicateId(username);
      setIsIdAvailable(available);
      setDupCheckMessage(available ? '사용 가능한 아이디입니다.' : '이미 사용중인 아이디입니다.');
    } catch (err: any) {
      setError(err.response?.data?.message || '중복 확인 중 오류가 발생했습니다.');
    }
  };

  return (
    <UserForm title="회원가입">
      <ErrorMessage message={error} />
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <FormInput
            type="text"
            placeholder="아이디를 입력해주세요"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setIsIdAvailable(null);
              setDupCheckMessage('');
            }}
            required
          />
        </div>
        <FormButton onClick={handleCheckDuplicate} fullWidth={false} variant="secondary">
          중복확인
        </FormButton>
      </div>

      {dupCheckMessage && (
        isIdAvailable ? (
          <SuccessMessage message={dupCheckMessage} />
        ) : (
          <ErrorMessage message={dupCheckMessage} />
        )
      )}
      
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