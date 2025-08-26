import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, checkDuplicateId } from '../../api/user/userApi';
import { UserForm, FormInput, FormButton, ErrorMessage, SuccessMessage } from '../../components/user';

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [passwordConfirm, setPasswordConfirm] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [dupCheckMessage, setDupCheckMessage] = useState<string>('');
  const [isIdAvailable, setIsIdAvailable] = useState<boolean | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);

  const [agreeAll, setAgreeAll] = useState<boolean>(false);
  const [agreePrivacyRequired, setAgreePrivacyRequired] = useState<boolean>(false);
  const [agreeTermsRequired, setAgreeTermsRequired] = useState<boolean>(false);
  const [agreeMarketingOptional, setAgreeMarketingOptional] = useState<boolean>(false);

  const navigate = useNavigate();

  const isPasswordStrong = useMemo(() => {
    // 영문+숫자+특수문자 8자 이상
    const pattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}[\]|;:'",.<>/?]).{8,}$/;
    return pattern.test(password);
  }, [password]);

  const isPasswordMatch = password.length > 0 && password === passwordConfirm;

  const handleRegister = async () => {
    if (!username || !password || !passwordConfirm || !email || !fullName || !nickname) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (!isPasswordStrong) {
      setError('비밀번호 규칙을 확인해주세요.');
      return;
    }

    if (!isPasswordMatch) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (isIdAvailable !== true) {
      setError('아이디 중복 확인을 먼저 진행해주세요.');
      alert('아이디 중복 확인을 먼저 진행해주세요.');
      return;
    }

    if (isEmailVerified !== true) {
      setError('이메일 본인확인을 완료해주세요.');
      alert('이메일 본인확인을 완료해주세요.');
      return;
    }

    if (!(agreePrivacyRequired && agreeTermsRequired)) {
      setError('필수 약관에 동의해주세요.');
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

  const handleVerifyEmail = async () => {
    // 실제 인증 로직 연동 전까지는 모의 처리
    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }
    setIsEmailVerified(true);
  };

  const toggleAgreeAll = (checked: boolean) => {
    setAgreeAll(checked);
    setAgreePrivacyRequired(checked);
    setAgreeTermsRequired(checked);
    setAgreeMarketingOptional(checked);
  };

  return (
    <UserForm title="">
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
        <FormButton onClick={handleVerifyEmail} fullWidth={false} style={{ height: '48px', alignSelf: 'stretch' }}>
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
        type="password"
        placeholder="비밀번호를 입력해주세요"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {!isPasswordStrong && password.length > 0 && (
        <ErrorMessage message="비밀번호 규칙을 확인해주세요. (영문+숫자+특수문자 8자 이상)" />
      )}

      <FormInput
        type="password"
        placeholder="비밀번호를 확인해주세요"
        value={passwordConfirm}
        onChange={(e) => setPasswordConfirm(e.target.value)}
        required
      />
      {passwordConfirm.length > 0 && !isPasswordMatch && (
        <ErrorMessage message="비밀번호가 일치하지 않습니다." />
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <FormInput
            type="email"
            placeholder="이메일을 입력해주세요"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <FormButton onClick={handleVerifyEmail} fullWidth={false} style={{ height: '48px', alignSelf: 'stretch' }}>
          본인확인
        </FormButton>
      </div>
      {isEmailVerified && <SuccessMessage message="사용가능한 이메일입니다." />}

      <FormInput
        type="text"
        placeholder="이름"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
      />

      <FormInput
        type="text"
        placeholder="닉네임"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        required
      />

      <div style={{ marginTop: 8, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
        개인정보 약관 동의
        <span style={{ float: 'right', fontWeight: 400 }}>
          전체 동의
          <input type="checkbox" style={{ marginLeft: 8 }} checked={agreeAll} onChange={(e) => toggleAgreeAll(e.target.checked)} />
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, fontSize: 14, textAlign: 'left' }}>
        <label style={{ cursor: 'pointer' }} onClick={() => alert('.') }>
          <input type="checkbox" checked={agreePrivacyRequired} onChange={(e) => setAgreePrivacyRequired(e.target.checked)} />
          {' '}<span style={{ color: '#001E4F', fontWeight: 600 }}>(필수)</span> 개인정보 처리방침 동의
        </label>
        <label style={{ cursor: 'pointer' }} onClick={() => alert('.') }>
          <input type="checkbox" checked={agreeTermsRequired} onChange={(e) => setAgreeTermsRequired(e.target.checked)} />
          {' '}<span style={{ color: '#001E4F', fontWeight: 600 }}>(필수)</span> 서비스 이용약관 동의
        </label>
        <label style={{ cursor: 'pointer' }} onClick={() => alert('마케팅 .') }>
          <input type="checkbox" checked={agreeMarketingOptional} onChange={(e) => setAgreeMarketingOptional(e.target.checked)} />
          {' '}<span style={{ color: '#6D6D6D' }}>(선택)</span> 마케팅 수신 동의
        </label>
      </div>

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