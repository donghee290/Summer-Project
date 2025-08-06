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
import { verifyToken } from '../../middlewares/user/auth';  // authenticateToken → verifyToken으로 변경

const router = Router();

// 공개 API 
router.get('/', getArticles);
router.get('/search', searchArticles);
router.get('/:id', getArticleById);

// 인증 필요한 API
router.post('/:id/bookmark', verifyToken, toggleBookmark);        // authenticateToken → verifyToken
router.post('/:id/like', verifyToken, toggleLike);                // authenticateToken → verifyToken
router.post('/:id/rating', verifyToken, addRating);               // authenticateToken → verifyToken

// 사용자별 북마크 조회
router.get('/bookmarks/my', verifyToken, getUserBookmarks);       // authenticateToken → verifyToken

export default router;
