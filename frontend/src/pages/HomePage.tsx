import React from 'react';
import { Button } from '../components/ui/Button';

export const HomePage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-gray-800 bg-white">
      <h1 className="mb-4 text-3xl font-bold">🎉 Welcome to Our Service!</h1>
      <p className="mb-6 text-lg">여기는 기본 홈페이지입니다.</p>
      <Button onClick={() => alert('홈페이지 버튼 클릭!')}>시작하기</Button>
    </div>
  );
};