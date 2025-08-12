import React, { useState } from 'react';
import { ProfileData } from './MyPageTypes';
import axios from 'axios';

interface ProfileInfoProps {
    data: ProfileData | null;
}

const ProfileInfo: React.FC<ProfileInfoProps> = ({ data }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [nickname, setNickname] = useState(data?.nickname || '');
    const [email, setEmail] = useState(data?.email || '');
    const [phone, setPhone] = useState(data?.phone || '');

    const handleSave = async () => {
        try {
            await axios.post('http://localhost:3001/api/mypage/profile/update', {
                nickname,
                email,
                phone,
            });
            setIsEditing(false);
            alert('프로필이 성공적으로 업데이트되었습니다.');
        } catch (error) {
            console.error('프로필 업데이트 오류:', error);
            alert('프로필 업데이트에 실패했습니다.');
        }
    };

    if (!data) return <p>프로필 정보를 불러올 수 없습니다.</p>;

    return (
        <div className="profile-info-section">
            <h2>프로필 정보</h2>
            <div>
                <strong>아이디:</strong> <span>{data.id}</span>
            </div>
            <div>
                <strong>가입일:</strong> <span>{data.joinDate}</span>
            </div>
            {isEditing ? (
                <>
                    <div>
                        <label>닉네임:</label>
                        <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
                    </div>
                    <div>
                        <label>이메일:</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label>휴대폰 번호:</label>
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                    <button onClick={handleSave}>저장</button>
                    <button onClick={() => setIsEditing(false)}>취소</button>
                </>
            ) : (
                <>
                    <div>
                        <strong>닉네임:</strong> <span>{data.nickname}</span>
                    </div>
                    <div>
                        <strong>이메일:</strong> <span>{data.email}</span>
                    </div>
                    <div>
                        <strong>휴대폰 번호:</strong> <span>{data.phone}</span>
                    </div>
                    <button onClick={() => setIsEditing(true)}>프로필 편집</button>
                </>
            )}
        </div>
    );
};

export default ProfileInfo;