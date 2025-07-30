import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resetPassword } from '../../api/user/userApi';
import { UserForm, FormInput, FormButton, ErrorMessage, SuccessMessage } from '../../components/user';

const PasswordResetPage: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const navigate = useNavigate();

  const handleResetPassword = async () => {
    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await resetPassword(email);
      setSuccess('비밀번호 재설정 이메일이 발송되었습니다.');
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
        가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
      </p>
      
      <FormInput
        type="email"
        placeholder="이메일을 입력해주세요"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      
      <FormButton
        onClick={handleResetPassword}
        disabled={isLoading}
      >
        {isLoading ? '전송 중...' : '비밀번호 재설정 이메일 보내기'}
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