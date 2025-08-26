import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { FaSearch, FaUser } from "react-icons/fa";
import IconButton from "../ui/IconButton";

const navItems = [
  { name: "홈", path: "/" },
  { name: "국내경제", path: "/articles" },
  { name: "해외경제", path: "/articles/global" },
  { name: "사회", path: "/articles/society" },
  { name: "트렌드", path: "/articles/trend" },
  { name: "커뮤니티", path: "/community" },
];

export default function Header() {
  const navigate = useNavigate();

  return (
    <header className="w-full border-b border-gray-300">
      <div className="flex items-center justify-between px-8 py-4 mx-auto max-w-7xl">
        {/* Logo */}
        <Link to="/" className="text-2xl font-bold">
          <img src="/images/logo.png" alt="로고" className="h-8" />
        </Link>

        {/* Navigation */}
        <nav className="flex gap-6 text-sm font-medium">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                isActive
                  ? "text-blue-600 border-b-2 border-blue-600 pb-1"
                  : "hover:text-blue-600 pb-1"
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Icons */}
        <div className="flex items-center gap-4 text-lg">
          <IconButton
            icon={FaSearch}
            onClick={() => navigate("/search")}
            size={20}
          />
          <IconButton
            icon={FaUser}
            onClick={() => navigate("/mypage")}
            size={20}
          />
        </div>
      </div>
    </header>
  );
}