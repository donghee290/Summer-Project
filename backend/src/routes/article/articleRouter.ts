// src/routes/article/articleRouter.ts
import { Router } from 'express';
import * as articleController from '../../controllers/article/articleController';
// ❌ import auth from '../../middlewares/user/auth';
import { verifyToken } from '../../middlewares/user/auth';  // ✅

const router = Router();

router.get('/articles', articleController.listArticles);
router.get('/articles/top3', articleController.getTop3Summaries);
router.get('/articles/:id', articleController.getArticleDetail);
router.post('/articles/:id/bookmark', verifyToken, articleController.toggleBookmark); // ✅
router.post('/articles/:id/like', verifyToken, articleController.toggleLike);         // ✅
router.post('/articles/:id/rating', verifyToken, articleController.createRating);     // ✅
router.get('/articles/search', articleController.searchArticles);
router.get('/articles/bookmarks/my', verifyToken, articleController.listMyBookmarks); // ✅


export default router;