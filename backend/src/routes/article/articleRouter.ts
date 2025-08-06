import { Router } from 'express';
import { 
  getArticles, 
  getArticleById, 
  toggleBookmark, 
  toggleLike, 
  addRating,
  getUserBookmarks,
  searchArticles
} from '../../controllers/article/articleController';
import { authenticateToken } from '../../middlewares/user/auth';

const router = Router();

// 공개 API (로그인 불필요)
router.get('/', getArticles);
router.get('/search', searchArticles);
router.get('/:id', getArticleById);

// 인증 필요한 API
router.post('/:id/bookmark', authenticateToken, toggleBookmark);
router.post('/:id/like', authenticateToken, toggleLike);
router.post('/:id/rating', authenticateToken, addRating);

// 사용자별 북마크 조회
router.get('/bookmarks/my', authenticateToken, getUserBookmarks);

export default router;
