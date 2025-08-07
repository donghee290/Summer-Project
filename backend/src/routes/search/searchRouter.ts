import express from 'express';
import { searchArticles } from '../../controllers/search/searchController';

const router = express.Router();

router.get("/", searchArticles);

export default router;