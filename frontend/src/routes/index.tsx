import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { SearchPage } from "../pages/SearchPage";
import { LoginPage, RegisterPage, PasswordResetPage } from "../pages/user";
import {
  CommunityHomePage,
  RepositoryFeedPage,
  PostCreatePage,
  PostDetailPage
} from "../pages/community";



const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/user/login" element={<LoginPage />} />
      <Route path="/user/register" element={<RegisterPage />} />
      <Route path="/user/password-reset" element={<PasswordResetPage />} />
      
      {/* 커뮤니티 라우트  */}
      <Route path="/community" element={<CommunityHomePage />} />
      <Route path="/community/repository/:repoId" element={<RepositoryFeedPage />} />
      <Route path="/community/repository/:repoId/new" element={<PostCreatePage />} />
      <Route path="/community/post/:postId" element={<PostDetailPage />} />
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;