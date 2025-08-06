import { Request, Response } from 'express';
import { callStoredProcedure } from '../../config/database/database';

export const searchArticles = async (req: Request, res: Response) => {
  const keyword = (req.query.keyword as string || '').trim();
  const category = (req.query.category as string || '').trim();
  const searchRange = (req.query.searchRange as string || '').trim();
  const sort = (req.query.sort as string || '').trim();
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = parseInt(req.query.offset as string) || 0;

  if (!keyword) {
    return res.status(400).json({ error: 'keyword 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const result = await callStoredProcedure<any[]>('WEB_SEARCH_ARTICLES', [
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
  } catch (err) {
    console.error('[WEB_SEARCH_ARTICLES ERROR]', err);
    return res.status(500).json({ error: '검색 중 오류 발생' });
  }
};