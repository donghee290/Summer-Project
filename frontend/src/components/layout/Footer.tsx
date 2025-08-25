import React from "react";

export default function Footer() {
  return (
    <footer className="w-full py-6 mt-10 text-sm text-gray-500 border-t border-gray-300 bg-gray-50">
      <div className="px-8 mx-auto text-center max-w-7xl">
        <p className="mb-1 font-semibold text-black">늬웃</p>
        <p className="mb-1">늬웃은 한양대학교 산업융합학부 학생들이 제작한 프로젝트성 웹사이트입니다.</p>
        <a
          href="https://github.com/donghee290/Summer-Project"
          className="underline hover:text-black"
          target="_blank"
          rel="noopener noreferrer"
        >
          Github 바로가기
        </a>
      </div>
    </footer>
  );
}