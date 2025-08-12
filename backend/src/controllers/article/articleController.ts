import { Request, Response } from 'express';
// 프로젝트 DB 호출 유틸 시그니처를 확인 후 주석을 해제하세요.
// import { callStoredProcedure } from '../../config/database/database';

// 공통 응답 포맷(프로젝트 컨벤션에 최대한 맞춘 스텁)
const ok = (res: Response, data: any, message?: string) =>
  res.status(200).json({ success: true, ...(message ? { message } : {}), data });
const fail = (res: Response, status: number, message: string) =>
  res.status(status).json({ success: false, message });

/**
 * GET /api/articles
 * 세 줄 요약 목록 페이지용 목록 API (페이지네이션)
 */
export const listArticles = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    // const [rows, meta] = await callStoredProcedure('WEB_LIST_ARTICLES', [page, limit]);
    // return ok(res, { articles: rows, pagination: meta });

    // 스텁 응답
    return ok(res, { articles: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  } catch (err: any) {
    console.error('[Article] listArticles error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * GET /api/articles/:id
 * 아티클(기사 요약) 상세 페이지
 */
export const getArticleDetail = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '잘못된 아티클 ID');

    
    //const userNo = (req as any).user?.userNo ?? null;
    //const [article, userInteractions] = await callStoredProcedure('WEB_GET_ARTICLE_DETAIL', [id, userNo]);
    


    return res.status(200).json({
      success: true,
      data: {
        article: [],
        userInteractions: { bookmarked: false, liked: false, rated: false, userRating: null },
      },
    });
  } catch (err: any) {
    console.error('[Article] getArticleDetail error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * POST /api/articles/:id/bookmark
 * 북마크 토글 (로그인 필수)
 */
export const toggleBookmark = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, '잘못된 아티클 ID');

    const userNo = (req as any).user?.userNo;
    if (!userNo) return fail(res, 401, '인증 필요');

    // const [result] = await callStoredProcedure('WEB_TOGGLE_BOOKMARK', [id, userNo]);
    // const bookmarked = !!result?.bookmarked;

    const bookmarked = true; // stub
    return res
      .status(200)
      .json({ success: true, message: bookmarked ? '북마크에 추가되었습니다' : '북마크가 해제되었습니다', bookmarked });
  } catch (err: any) {
    console.error('[Article] toggleBookmark error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * POST /api/articles/:id/like
 * 좋아요 토글 (로그인 필수)
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

    const liked = true; // stub
    const likeCount = 1; // stub
    return res
      .status(200)
      .json({ success: true, message: liked ? '좋아요가 등록되었습니다' : '좋아요가 취소되었습니다', liked, likeCount });
  } catch (err: any) {
    console.error('[Article] toggleLike error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * POST /api/articles/:id/rating
 * 별점 등록 (1회만, 수정 불가)
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

    // try {
    //   const [result] = await callStoredProcedure('WEB_CREATE_RATING', [id, userNo, rating]);
    //   return res.status(200).json({ success: true, message: '별점이 등록되었습니다', data: result });
    // } catch (e: any) {
    //   if (e?.code === 'ALREADY_RATED') return fail(res, 400, '이미 평가한 아티클입니다');
    //   throw e;
    // }

    return res
      .status(200)
      .json({ success: true, message: '별점이 등록되었습니다', data: { userRating: rating, avgRating: 0, ratingCount: 0 } });
  } catch (err: any) {
    console.error('[Article] createRating error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * GET /api/articles/search
 * 아티클 검색 (키워드/카테고리)
 */
export const searchArticles = async (req: Request, res: Response) => {
  try {
    const keyword = (req.query.keyword as string) ?? null;
    const category = (req.query.category as string) ?? null;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    // const [rows, meta] = await callStoredProcedure('WEB_SEARCH_ARTICLES', [keyword, category, page, limit]);

    return ok(res, {
      articles: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
      searchInfo: { keyword, category },
    });
  } catch (err: any) {
    console.error('[Article] searchArticles error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};

/**
 * GET /api/articles/bookmarks/my
 * 내 북마크 목록 (로그인 필수)
 */
export const listMyBookmarks = async (req: Request, res: Response) => {
  try {
    const userNo = (req as any).user?.userNo;
    if (!userNo) return fail(res, 401, '인증 필요');

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    // const [rows, meta] = await callStoredProcedure('WEB_LIST_BOOKMARKS', [userNo, page, limit]);

    return ok(res, { articles: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  } catch (err: any) {
    console.error('[Article] listMyBookmarks error:', err);
    return fail(res, 500, '잠시 후 다시 시도해 주세요.');
  }
};
