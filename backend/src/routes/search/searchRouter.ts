import express from 'express';
import { searchArticles } from '../../controllers/search/searchController';

const router = express.Router();

router.get("/search", searchArticles);

export default router;