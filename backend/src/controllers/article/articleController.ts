import { Request, Response } from 'express';
import { pool } from '../../config/database/databaseConnectionPool';

// 아티클 목록 조회 (3줄 요약 페이지)
export const getArticles = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      `SELECT 
        article_no, 
        article_title, 
        article_summary, 
        article_category, 
        article_press,
        article_reg_at,
        (SELECT AVG(rating_score) FROM Rating WHERE Rating.article_no = Article.article_no) as avg_rating,
        (SELECT COUNT(*) FROM Likes WHERE Likes.article_no = Article.article_no) as likes_count
       FROM Article 
       ORDER BY article_reg_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // 전체 개수 조회
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM Article'
    );
    const total = (countResult as any[])[0].total;

    res.json({
      success: true,
      data: {
        articles: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('getArticles 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '아티클 목록을 불러오는데 실패했습니다' 
    });
  }
};

// 아티클 상세 조회
export const getArticleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    // 아티클 정보 조회
    const [articleRows] = await pool.execute(
      `SELECT 
        article_no,
        article_title,
        article_summary,
        article_content,
        article_category,
        article_press,
        article_source,
        article_author,
        article_reg_at,
        article_update_at,
        (SELECT AVG(rating_score) FROM Rating WHERE Rating.article_no = Article.article_no) as avg_rating,
        (SELECT COUNT(*) FROM Likes WHERE Likes.article_no = Article.article_no) as likes_count
       FROM Article 
       WHERE article_no = ?`, 
      [id]
    );

    if ((articleRows as any[]).length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '아티클을 찾을 수 없습니다' 
      });
    }

    const article = (articleRows as any[])[0];

    // 사용자별 상호작용 정보 조회 (로그인한 경우만)
    let userInteractions = {
      bookmarked: false,
      liked: false,
      rated: false,
      userRating: null
    };

    if (userId) {
      // 북마크 상태 확인
      const [bookmarkRows] = await pool.execute(
        'SELECT * FROM Bookmark WHERE user_no = ? AND article_no = ?',
        [userId, id]
      );
      userInteractions.bookmarked = (bookmarkRows as any[]).length > 0;

      // 좋아요 상태 확인
      const [likeRows] = await pool.execute(
        'SELECT * FROM Likes WHERE user_no = ? AND article_no = ?',
        [userId, id]
      );
      userInteractions.liked = (likeRows as any[]).length > 0;

      // 별점 상태 확인
      const [ratingRows] = await pool.execute(
        'SELECT rating_score FROM Rating WHERE user_no = ? AND article_no = ?',
        [userId, id]
      );
      if ((ratingRows as any[]).length > 0) {
        userInteractions.rated = true;
        userInteractions.userRating = (ratingRows as any[])[0].rating_score;
      }
    }

    res.json({
      success: true,
      data: {
        article,
        userInteractions
      }
    });
  } catch (error) {
    console.error('getArticleById 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '아티클 상세 정보를 불러오는데 실패했습니다' 
    });
  }
};

// 북마크 등록/해제 (토글)
export const toggleBookmark = async (req: Request, res: Response) => {
  try {
    const { id: articleNo } = req.params;
    const userNo = (req as any).user.id;

    // 아티클 존재 확인
    const [articleCheck] = await pool.execute(
      'SELECT article_no FROM Article WHERE article_no = ?',
      [articleNo]
    );

    if ((articleCheck as any[]).length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '존재하지 않는 아티클입니다' 
      });
    }

    // 기존 북마크 확인
    const [existing] = await pool.execute(
      'SELECT * FROM Bookmark WHERE user_no = ? AND article_no = ?',
      [userNo, articleNo]
    );

    if ((existing as any[]).length > 0) {
      // 북마크 해제
      await pool.execute(
        'DELETE FROM Bookmark WHERE user_no = ? AND article_no = ?',
        [userNo, articleNo]
      );
      res.json({ 
        success: true, 
        message: '북마크가 해제되었습니다', 
        bookmarked: false 
      });
    } else {
      // 북마크 등록
      await pool.execute(
        'INSERT INTO Bookmark (user_no, article_no) VALUES (?, ?)',
        [userNo, articleNo]
      );
      res.json({ 
        success: true, 
        message: '북마크에 추가되었습니다', 
        bookmarked: true 
      });
    }
  } catch (error) {
    console.error('toggleBookmark 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '북마크 처리 중 오류가 발생했습니다' 
    });
  }
};

// 좋아요 토글
export const toggleLike = async (req: Request, res: Response) => {
  try {
    const { id: articleNo } = req.params;
    const userNo = (req as any).user.id;

    // 아티클 존재 확인
    const [articleCheck] = await pool.execute(
      'SELECT article_no FROM Article WHERE article_no = ?',
      [articleNo]
    );

    if ((articleCheck as any[]).length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '존재하지 않는 아티클입니다' 
      });
    }

    // 기존 좋아요 확인
    const [existing] = await pool.execute(
      'SELECT * FROM Likes WHERE user_no = ? AND article_no = ?',
      [userNo, articleNo]
    );

    if ((existing as any[]).length > 0) {
      // 좋아요 취소
      await pool.execute(
        'DELETE FROM Likes WHERE user_no = ? AND article_no = ?',
        [userNo, articleNo]
      );
      res.json({ 
        success: true, 
        message: '좋아요가 취소되었습니다', 
        liked: false 
      });
    } else {
      // 좋아요 등록
      await pool.execute(
        'INSERT INTO Likes (user_no, article_no) VALUES (?, ?)',
        [userNo, articleNo]
      );
      res.json({ 
        success: true, 
        message: '좋아요가 등록되었습니다', 
        liked: true 
      });
    }
  } catch (error) {
    console.error('toggleLike 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '좋아요 처리 중 오류가 발생했습니다' 
    });
  }
};

// 별점 등록 (1회만 가능, 수정 불가)
export const addRating = async (req: Request, res: Response) => {
  try {
    const { id: articleNo } = req.params;
    const { rating } = req.body;
    const userNo = (req as any).user.id;

    // 입력값 검증
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
      return res.status(400).json({
        success: false,
        message: '별점은 1~5 사이의 정수여야 합니다'
      });
    }

    // 아티클 존재 확인
    const [articleCheck] = await pool.execute(
      'SELECT article_no FROM Article WHERE article_no = ?',
      [articleNo]
    );

    if ((articleCheck as any[]).length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '존재하지 않는 아티클입니다' 
      });
    }

    // 이미 평가했는지 확인
    const [existing] = await pool.execute(
      'SELECT * FROM Rating WHERE user_no = ? AND article_no = ?',
      [userNo, articleNo]
    );

    if ((existing as any[]).length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: '이미 평가한 아티클입니다. 별점은 1회만 등록 가능합니다.' 
      });
    }

    // 별점 등록
    await pool.execute(
      'INSERT INTO Rating (user_no, article_no, rating_score) VALUES (?, ?, ?)',
      [userNo, articleNo, rating]
    );

    // 평균 별점 계산
    const [avgResult] = await pool.execute(
      'SELECT AVG(rating_score) as avg_rating, COUNT(*) as rating_count FROM Rating WHERE article_no = ?',
      [articleNo]
    );

    const avgRating = Number((avgResult as any[])[0].avg_rating).toFixed(1);
    const ratingCount = (avgResult as any[])[0].rating_count;

    res.json({ 
      success: true, 
      message: '별점이 등록되었습니다',
      data: {
        userRating: rating,
        avgRating: parseFloat(avgRating),
        ratingCount: ratingCount
      }
    });
  } catch (error) {
    console.error('addRating 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '별점 등록 중 오류가 발생했습니다' 
    });
  }
};

// 사용자의 북마크된 아티클 목록 조회
export const getUserBookmarks = async (req: Request, res: Response) => {
  try {
    const userNo = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      `SELECT 
        a.article_no, 
        a.article_title, 
        a.article_summary, 
        a.article_category, 
        a.article_press,
        a.article_reg_at,
        (SELECT AVG(rating_score) FROM Rating WHERE Rating.article_no = a.article_no) as avg_rating,
        (SELECT COUNT(*) FROM Likes WHERE Likes.article_no = a.article_no) as likes_count
       FROM Article a
       JOIN Bookmark b ON a.article_no = b.article_no
       WHERE b.user_no = ?
       ORDER BY a.article_reg_at DESC
       LIMIT ? OFFSET ?`,
      [userNo, limit, offset]
    );

    // 전체 북마크 개수 조회
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM Bookmark WHERE user_no = ?',
      [userNo]
    );
    const total = (countResult as any[])[0].total;

    res.json({
      success: true,
      data: {
        bookmarks: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('getUserBookmarks 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '북마크 목록을 불러오는데 실패했습니다' 
    });
  }
};

// 아티클 검색
export const searchArticles = async (req: Request, res: Response) => {
  try {
    const { keyword, category } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let queryParams: any[] = [];

    if (keyword) {
      whereClause += 'WHERE (article_title LIKE ? OR article_summary LIKE ? OR article_content LIKE ?)';
      const keywordParam = `%${keyword}%`;
      queryParams.push(keywordParam, keywordParam, keywordParam);
    }

    if (category) {
      whereClause += whereClause ? ' AND ' : 'WHERE ';
      whereClause += 'article_category = ?';
      queryParams.push(category);
    }

    const [rows] = await pool.execute(
      `SELECT 
        article_no, 
        article_title, 
        article_summary, 
        article_category, 
        article_press,
        article_reg_at,
        (SELECT AVG(rating_score) FROM Rating WHERE Rating.article_no = Article.article_no) as avg_rating,
        (SELECT COUNT(*) FROM Likes WHERE Likes.article_no = Article.article_no) as likes_count
       FROM Article 
       ${whereClause}
       ORDER BY article_reg_at DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    // 검색 결과 개수 조회
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM Article ${whereClause}`,
      queryParams
    );
    const total = (countResult as any[])[0].total;

    res.json({
      success: true,
      data: {
        articles: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        searchInfo: {
          keyword: keyword || null,
          category: category || null
        }
      }
    });
  } catch (error) {
    console.error('searchArticles 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '아티클 검색 중 오류가 발생했습니다' 
    });
  }
};
