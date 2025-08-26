// src/controllers/article/articleController.ts
import { Request, Response } from 'express';
import { callStoredProcedure } from '../../config/database/database'; // ← 실제 프로젝트 경로 유지

// src/controllers/article/articleController.ts (맨 위 import 들 아래)
function extractRows(result: any): any[] {
  // mysql2/promise: CALL 프로시저 결과는 보통 [ [rows], fields ]
  if (Array.isArray(result)) {
    // 1) [[...], fields] 형태
    if (Array.isArray(result[0])) return result[0];
    // 2) 그냥 [...] 형태로 rows만 올 때
    return result;
  }
  // 3) { rows: [...] } 같은 커스텀 포맷
  if (result?.rows && Array.isArray(result.rows)) return result.rows;

  // 4) 그 외는 빈 배열
  return [];
}

// 공통 응답 헬퍼
const ok = (res: Response, data: any, message?: string) =>
  res.status(200).json({ success: true, ...(message ? { message } : {}), data });

const fail = (res: Response, status: number, message: string) =>
  res.status(status).json({ success: false, message });



/**
 * GET /api/articles
 * 쿼리: page, limit, (옵션) keyword, category, searchRange, sort, startDate, endDate
 * 프로시저: WEB_ARTICLE_LIST(p_keyword, p_category, p_searchRange, p_sort, p_startDate, p_endDate, p_limit, p_offset)
 */
export const listArticles = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.max(1, Number(req.query.limit ?? 20));
    const offset = (page - 1) * limit;

    const keyword = (req.query.keyword as string) ?? '';                // '' 허용
    const category = (req.query.category as string) ?? '';              // '' 허용
    const searchRange = (req.query.searchRange as string) || 'title_content';
    const sort = (req.query.sort as string) || 'latest';
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : null;
    const endDate   = req.query.endDate   ? new Date(String(req.query.endDate))   : null;

    const raw = await callStoredProcedure('WEB_ARTICLE_LIST', [
      keyword,
      category,
      searchRange,
      sort,
      startDate,
      endDate,
      limit,
      offset,
    ]) as any;
    const rows = extractRows(raw);

    // WEB_ARTICLE_LIST는 total_count를 각 행에 싣도록 만들어짐
    const total =
      Array.isArray(rows) && rows.length > 0 && rows[0]?.total_count
        ? Number(rows[0].total_count)
        : 0;

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return ok(res, {
      articles: rows ?? [],
      pagination: { page, limit, total, totalPages },
    });
  } catch (err: any) {
    console.error('[Article] listArticles error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * GET /api/articles/:id
 * 프로시저: WEB_ARTICLE_DETAIL(p_article_no)
 */
export const getArticleDetail = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '잘못된 아티클 ID');

    const raw = await callStoredProcedure('WEB_ARTICLE_DETAIL', [id]) as any;
    const rows = extractRows(raw);

    // 프론트는 배열/단건 모두 대응하지만, 배열 형태로 전달
    const articleArray = Array.isArray(rows) ? rows : rows ? [rows] : [];

    return ok(res, {
      article: articleArray,
      // TODO: 사용자 상호작용은 별도 프로시저 도입 시 교체
      userInteractions: { bookmarked: false, liked: false, rated: false, userRating: null },
    });
  } catch (err: any) {
    console.error('[Article] getArticleDetail error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * POST /api/articles/:id/bookmark
 * TODO: WEB_TOGGLE_BOOKMARK(article_no, user_no) 프로시저 연결
 * 인증: verifyToken 미들웨어에서 req.user.userNo 설정 필요
 */
export const toggleBookmark = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '잘못된 아티클 ID');

    const userNo = (req as any).user?.userNo;
    if (!userNo) return fail(res, 401, '인증 필요');

    // const [result] = await callStoredProcedure('WEB_TOGGLE_BOOKMARK', [id, userNo]);
    // const bookmarked = !!result?.bookmarked;

    // 임시 성공 응답 (프로시저 연결 전)
    const bookmarked = true;
    return res.status(200).json({
      success: true,
      message: bookmarked ? '북마크에 추가되었습니다' : '북마크가 해제되었습니다',
      bookmarked,
    });
  } catch (err: any) {
    console.error('[Article] toggleBookmark error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * POST /api/articles/:id/like
 * TODO: WEB_TOGGLE_LIKE(article_no, user_no) 프로시저 연결
 */
export const toggleLike = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '잘못된 아티클 ID');

    const userNo = (req as any).user?.userNo;
    if (!userNo) return fail(res, 401, '인증 필요');

    // const [result] = await callStoredProcedure('WEB_TOGGLE_LIKE', [id, userNo]);
    // const liked = !!result?.liked;
    // const likeCount = Number(result?.likeCount ?? 0);

    // 임시 성공 응답 (프로시저 연결 전)
    const liked = true;
    const likeCount = 1;
    return res.status(200).json({
      success: true,
      message: liked ? '좋아요가 등록되었습니다' : '좋아요가 취소되었습니다',
      liked,
      likeCount,
    });
  } catch (err: any) {
    console.error('[Article] toggleLike error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * POST /api/articles/:id/rating
 * TODO: WEB_CREATE_RATING(article_no, user_no, rating) 프로시저 연결
 */
export const createRating = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '잘못된 아티클 ID');

    const userNo = (req as any).user?.userNo;
    if (!userNo) return fail(res, 401, '인증 필요');

    const rating = Number((req.body as any)?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return fail(res, 400, '별점은 1~5 사이의 정수여야 합니다');
    }

    // const [result] = await callStoredProcedure('WEB_CREATE_RATING', [id, userNo, rating]);
    // return res.status(200).json({ success: true, message: '별점이 등록되었습니다', data: result });

    // 임시 성공 응답 (프로시저 연결 전)
    return res.status(200).json({
      success: true,
      message: '별점이 등록되었습니다',
      data: { userRating: rating, avgRating: rating, ratingCount: 1 },
    });
  } catch (err: any) {
    if (err?.code === 'ALREADY_RATED') return fail(res, 400, '이미 평가한 아티클입니다');
    console.error('[Article] createRating error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * GET /api/articles/search
 * 목록 프로시저를 재사용하여 키워드/카테고리 검색
 */
export const searchArticles = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.max(1, Number(req.query.limit ?? 20));
    const offset = (page - 1) * limit;

    const keyword = (req.query.keyword as string) ?? '';
    const category = (req.query.category as string) ?? '';
    const searchRange = (req.query.searchRange as string) || 'title_content';
    const sort = (req.query.sort as string) || 'latest';
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : null;
    const endDate   = req.query.endDate   ? new Date(String(req.query.endDate))   : null;

    const raw = await callStoredProcedure('WEB_ARTICLE_LIST', [
      keyword,
      category,
      searchRange,
      sort,
      startDate,
      endDate,
      limit,
      offset,
    ]) as any;
    const rows = extractRows(raw);

    const total =
      Array.isArray(rows) && rows.length > 0 && rows[0]?.total_count
        ? Number(rows[0].total_count)
        : 0;

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return ok(res, {
      articles: rows ?? [],
      pagination: { page, limit, total, totalPages },
      searchInfo: { keyword, category },
    });
  } catch (err: any) {
    console.error('[Article] searchArticles error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * GET /api/articles/bookmarks/my
 * TODO: WEB_LIST_BOOKMARKS(user_no, page, limit) 같은 프로시저가 준비되면 연결
 */
export const listMyBookmarks = async (req: Request, res: Response) => {
  try {
    const userNo = (req as any).user?.userNo;
    if (!userNo) return fail(res, 401, '인증 필요');

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.max(1, Number(req.query.limit ?? 20));

    // const offset = (page - 1) * limit;
    // const [rows] = await callStoredProcedure('WEB_LIST_BOOKMARKS', [userNo, page, limit]);
    // const total = rows?.[0]?.total_count ?? 0;

    // 임시 빈 응답 (프로시저 연결 전)
    return ok(res, {
      articles: [],
      pagination: { page, limit, total: 0, totalPages: 1 },
    });
  } catch (err: any) {
    console.error('[Article] listMyBookmarks error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};
/**
 * GET /api/articles/top3
 * 쿼리: topCategory, dateFrom, dateTo, limit, lines
 * 프로시저: WEB_ARTICLE_TOP3(topCategory, dateFrom, dateTo, limit, lines)
 */
function getTodayKSTRangeISO() {
  const nowUtc = new Date();
  // shift to KST (+09:00)
  const kstMs = nowUtc.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1; // 1-12
  const d = kst.getUTCDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const fromISO = `${y}-${pad(m)}-${pad(d)}T00:00:00+09:00`;
  const toISO   = `${y}-${pad(m)}-${pad(d)}T23:59:59+09:00`;
  return { fromISO, toISO };
}

function isoToMySQLDateTime(iso: string): string {
  // "2025-08-26T00:00:00+09:00" -> "2025-08-26 00:00:00"
  if (!iso) return iso;
  const base = iso.replace('T', ' ');
  // cut off timezone part if present
  const idx = base.indexOf('+');
  const core = idx > -1 ? base.slice(0, idx) : base;
  return core.slice(0, 19);
}

function toStringArrayMaybeJSON(v: any): string[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export const getTop3Summaries = async (req: Request, res: Response) => {
  try {
    const topCategory = req.query.topCategory as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const limitRaw = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    const linesRaw = req.query.lines !== undefined ? Number(req.query.lines) : undefined;
    const limit = Number.isInteger(limitRaw) && (limitRaw as number) > 0 ? (limitRaw as number) : 3;
    const lines = Number.isInteger(linesRaw) && (linesRaw as number) > 0 ? (linesRaw as number) : 3;

    // Validate required params
    if (!topCategory || !dateFrom || !dateTo) {
      return fail(res, 400, 'topCategory, dateFrom, dateTo는 필수입니다.');
    }

    const dateFromSQL = isoToMySQLDateTime(dateFrom);
    const dateToSQL   = isoToMySQLDateTime(dateTo);

    const params = [
      topCategory,
      dateFromSQL,
      dateToSQL,
      limit,
      lines,
    ];
    const raw = await callStoredProcedure('WEB_ARTICLE_TOP3', params) as any;
    let rows = extractRows(raw);

    // Fallback: if no data for the given range (e.g., yesterday empty), try TODAY (KST)
    if (!rows || (Array.isArray(rows) && rows.length === 0)) {
      const { fromISO, toISO } = getTodayKSTRangeISO();
      const rawToday = await callStoredProcedure('WEB_ARTICLE_TOP3', [
        topCategory,
        isoToMySQLDateTime(fromISO),
        isoToMySQLDateTime(toISO),
        limit,
        lines,
      ]) as any;
      rows = extractRows(rawToday);
    }

    const items = (rows ?? []).map((row: any) => {
      let summary3: string[] = [];
     
     // 1) JSON 배열 필드 (다른 환경 호환)
    const arr = toStringArrayMaybeJSON?.(row.summary_lines);
    if (Array.isArray(arr)) {
      summary3 = arr.slice(0, 3);
    } else if (typeof row.summary_concat === 'string' && row.summary_concat.length > 0) {
      // 2) 이번 프로시저 버전: '요약1||요약2||요약3'
     summary3 = row.summary_concat
      .split('||')
      .map((s: string) => s.trim())
      .filter((v: string) => v.length > 0)
      .slice(0, 3);
    } else {
      // 3) 혹시 summary1~3 개별 컬럼이 온다면
      summary3 = [row.summary1, row.summary2, row.summary3]
        .filter((s: any) => typeof s === 'string' && s.length > 0)
        .slice(0, 3);
    }

    return {
      article_no: Number(row.article_no),
      headline: row.headline,
      top_category: row.top_category,
      summary3,
    };
  });

    return ok(res, { items });
  } catch (err: any) {
    console.error('[Article] getTop3Summaries error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};