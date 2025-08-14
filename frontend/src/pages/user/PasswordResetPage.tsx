import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resetPassword } from '../../api/user/userApi';
import { UserForm, FormInput, FormButton, ErrorMessage, SuccessMessage } from '../../components/user';

const PasswordResetPage: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const navigate = useNavigate();

  const handleResetPassword = async () => {
    if (!username || !email) {
      setError('아이디와 이메일을 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const { tempPassword } = await resetPassword({ username, email });
      setSuccess(`비밀번호가 초기화되었습니다. 임시 비밀번호: ${tempPassword}`);
    } catch (err: any) {
      setError(err.response?.data?.message || '비밀번호 재설정에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <UserForm title="비밀번호 초기화">
      <ErrorMessage message={error} />
      <SuccessMessage message={success} />
      
      <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
        아이디와 이메일을 입력하면 비밀번호가 4자리 숫자 임시 비밀번호로 초기화됩니다.
      </p>

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
      
      <FormButton onClick={handleResetPassword} disabled={isLoading}>
        {isLoading ? '처리 중...' : '비밀번호 초기화'}
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

export default PasswordResetPage; 