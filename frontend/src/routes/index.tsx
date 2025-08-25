import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { SearchPage } from "../pages/search";
import { LoginPage, RegisterPage, PasswordResetPage } from "../pages/user";
import { ArticleListPage, ArticleDetailPage } from "../pages/article";
import { CommunityHomePage, RepositoryFeedPage, PostCreatePage, PostDetailPage } from "../pages/community";

import Layout from "../components/layout/Layout";


const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      {/* Layout 없는 페이지 */}
      <Route path="/user/login" element={<LoginPage />} />
      <Route path="/user/register" element={<RegisterPage />} />
      <Route path="/user/password-reset" element={<PasswordResetPage />} />

      {/* Layout 적용된 페이지 */}
      <Route path="/" element={<Layout><HomePage /></Layout>} />
      <Route path="/search" element={<Layout><SearchPage /></Layout>} />
      <Route path="/articles" element={<Layout><ArticleListPage /></Layout>} />
      <Route path="/articles/:articleId" element={<Layout><ArticleDetailPage /></Layout>} />

      <Route path="/community" element={<Layout><CommunityHomePage /></Layout>} />
      <Route path="/community/repository/:repoId" element={<Layout><RepositoryFeedPage /></Layout>} />
      <Route path="/community/repository/:repoId/new" element={<Layout><PostCreatePage /></Layout>} />
      <Route path="/community/post/:postId" element={<Layout><PostDetailPage /></Layout>} />
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;