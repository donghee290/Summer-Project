import React from 'react';
import axios from 'axios';

const AccountManagement: React.FC = () => {
    const handleLogout = async () => {
        try {
            await axios.post('http://localhost:3001/api/mypage/logout');
            alert('로그아웃되었습니다.');
            // 로그아웃 후 로그인 페이지로 리디렉션 로직 추가
        } catch (error) {
            console.error('로그아웃 오류:', error);
            alert('로그아웃에 실패했습니다.');
        }
    };

    const handleWithdrawal = async () => {
        if (window.confirm('정말로 회원 탈퇴하시겠습니까?')) {
            try {
                await axios.delete('http://localhost:3001/api/mypage/withdraw');
                alert('회원 탈퇴가 완료되었습니다.');
                // 탈퇴 후 메인 페이지로 리디렉션 로직 추가
            } catch (error) {
                console.error('회원 탈퇴 오류:', error);
                alert('회원 탈퇴에 실패했습니다.');
            }
        }
    };

    return (
        <div className="account-management-section">
            <h2>계정 관리</h2>
            <div className="account-management-item">
                <h3>비밀번호 변경</h3>
                <p>비밀번호 변경 시 휴대폰 인증 과정이 필요합니다.</p>
                <button>비밀번호 변경</button>
            </div>
            <div className="account-management-item">
                <h3>로그아웃</h3>
                <p>로그인 상태의 계정을 로그아웃으로 전환합니다.</p>
                <button onClick={handleLogout}>로그아웃</button>
            </div>
            <div className="account-management-item">
                <h3>회원 탈퇴</h3>
                <p>탈퇴 시 이전 비밀번호 입력 후 승인 요청을 진행합니다.</p>
                <button onClick={handleWithdrawal} className="withdrawal-button">회원 탈퇴</button>
            </div>
        </div>
    );
};

export default AccountManagement;