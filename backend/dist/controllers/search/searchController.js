"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchArticles = void 0;
const database_1 = require("../../config/database/database");
const searchArticles = async (req, res) => {
    const keyword = (req.query.keyword || '').trim();
    const category = (req.query.category || '').trim();
    const searchRange = (req.query.searchRange || '').trim();
    const sort = (req.query.sort || '').trim();
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    if (!keyword) {
        return res.status(400).json({ error: 'keyword 쿼리 파라미터가 필요합니다.' });
    }
    try {
        const result = await (0, database_1.callStoredProcedure)('WEB_SEARCH_ARTICLES', [
            keyword,
            category,
            searchRange,
            sort,
            startDate,
            endDate,
            limit,
            offset
        ]);
        return res.status(200).json({ results: result || [] });
    }
    catch (err) {
        console.error('[WEB_SEARCH_ARTICLES ERROR]', err);
        return res.status(500).json({ error: '검색 중 오류 발생' });
    }
};
exports.searchArticles = searchArticles;
