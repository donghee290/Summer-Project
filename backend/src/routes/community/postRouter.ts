import { Router } from "express";
import { db } from "../../db";

const router = Router();

/** 1) 전체 게시글 목록 */
router.get("/", async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id, p.title, p.content, p.image_url AS image, u.user_id AS author,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments,
        DATE_ADD(p.created_at, INTERVAL 9 HOUR) AS created_at  -- ✅ KST 변환
      FROM posts p
      JOIN User u ON u.user_no = p.user_no
      ORDER BY p.created_at DESC
    `);

    const data = (rows as any[]).map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      image: r.image || null,
      author: r.author,
      likes: Number(r.likes),
      liked: false,
      comments: Number(r.comments),
      created_at: r.created_at,
    }));

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

/** 2) 게시글 상세 (+ 댓글 목록) */
router.get("/:id", async (req, res) => {
  const postId = Number(req.params.id);
  try {
    const [rows] = await db.query(
      `
      SELECT
        p.id, p.title, p.content, p.image_url AS image, u.user_id AS author,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes,
        DATE_ADD(p.created_at, INTERVAL 9 HOUR) AS created_at  -- ✅ KST 변환
      FROM posts p
      JOIN User u ON u.user_no = p.user_no
      WHERE p.id = ?
    `,
      [postId]
    );

    if ((rows as any[]).length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    const r: any = (rows as any[])[0];

    // ✅ 댓글 조회 (KST 변환, 최신순)
    const [comments] = await db.query(
      `
      SELECT 
        c.id, 
        u.user_id AS user, 
        u.user_no, 
        c.content, 
        DATE_ADD(c.created_at, INTERVAL 9 HOUR) AS created_at
      FROM comments c
      JOIN User u ON u.user_no = c.user_no
      WHERE c.post_id = ?
      ORDER BY c.created_at DESC
    `,
      [postId]
    );

    res.json({
      id: r.id,
      title: r.title,
      content: r.content,
      image: r.image,
      author: r.author,
      likes: Number(r.likes),
      liked: false,
      comments: (comments as any[]).length,
      created_at: r.created_at,
      commentList: comments,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch post detail" });
  }
});

/** 3) 게시글 작성 */
router.post("/", async (req, res) => {
  const { title, content, image } = req.body;
  const userNo = 1; // 로그인 연동 전 임시

  if (!title || !content) {
    return res.status(400).json({ message: "title, content are required" });
  }

  try {
    const [result] = await db.query(
      `
      INSERT INTO posts (user_no, title, content, image_url, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `,
      [userNo, title, content, image || null]
    );

    const insertId = (result as any).insertId;
    const [rows] = await db.query(
      `
      SELECT p.id, p.title, p.content, p.image_url AS image, u.user_id AS author,
             DATE_ADD(p.created_at, INTERVAL 9 HOUR) AS created_at
      FROM posts p
      JOIN User u ON u.user_no = p.user_no
      WHERE p.id = ?
    `,
      [insertId]
    );

    const r: any = (rows as any[])[0];
    res.status(201).json({
      id: r.id,
      title: r.title,
      content: r.content,
      image: r.image,
      author: r.author,
      likes: 0,
      liked: false,
      comments: 0,
      created_at: r.created_at,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to create post" });
  }
});

/** 4) 댓글 작성 */
router.post("/:id/comments", async (req, res) => {
  const postId = Number(req.params.id);
  const { content } = req.body;
  const userNo = 1; // 로그인 연동 전

  if (!content?.trim()) {
    return res.status(400).json({ message: "content is required" });
  }

  try {
    const [result] = await db.query(
      `
      INSERT INTO comments (user_no, post_id, content, created_at)
      VALUES (?, ?, ?, NOW())
    `,
      [userNo, postId, content.trim()]
    );

    const insertId = (result as any).insertId;
    const [rows] = await db.query(
      `
      SELECT c.id, u.user_id AS user, u.user_no, c.content,
             DATE_ADD(c.created_at, INTERVAL 9 HOUR) AS created_at
      FROM comments c
      JOIN User u ON u.user_no = c.user_no
      WHERE c.id = ?
    `,
      [insertId]
    );

    res.status(201).json((rows as any[])[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to create comment" });
  }
});

/** 5) 좋아요 토글 */
router.post("/:id/like", async (req, res) => {
  const postId = Number(req.params.id);
  const userNo = 1; // 로그인 연동 전

  try {
    const [exists] = await db.query(
      `SELECT 1 FROM post_likes WHERE user_no = ? AND post_id = ?`,
      [userNo, postId]
    );

    if ((exists as any[]).length) {
      await db.query(
        `DELETE FROM post_likes WHERE user_no = ? AND post_id = ?`,
        [userNo, postId]
      );
    } else {
      await db.query(
        `INSERT INTO post_likes (user_no, post_id, created_at) VALUES (?, ?, NOW())`,
        [userNo, postId]
      );
    }

    const [cnt] = await db.query(
      `SELECT COUNT(*) AS likes FROM post_likes WHERE post_id = ?`,
      [postId]
    );
    const likes = Number((cnt as any[])[0].likes);

    res.json({ liked: (exists as any[]).length === 0, likes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to toggle like" });
  }
});

/** 6) 게시글 삭제 */
router.delete("/:id", async (req, res) => {
  const postId = Number(req.params.id);
  const userNo = 1; // 로그인 연동 전 임시 유저 번호

  try {
    const [rows] = await db.query(
      `SELECT user_no FROM posts WHERE id = ?`,
      [postId]
    );

    if ((rows as any[]).length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    const post = (rows as any[])[0];
    if (post.user_no !== userNo) {
      return res.status(403).json({ message: "You can delete only your posts" });
    }

    await db.query(`DELETE FROM posts WHERE id = ?`, [postId]);
    res.json({ message: "Post deleted successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

/** 7) 댓글 삭제 */
router.delete("/:postId/comments/:commentId", async (req, res) => {
  const postId = Number(req.params.postId);
  const commentId = Number(req.params.commentId);
  const userNo = 1; // 로그인 연동 전 임시 유저 번호

  try {
    const [rows] = await db.query(
      `SELECT user_no FROM comments WHERE id = ? AND post_id = ?`,
      [commentId, postId]
    );

    if ((rows as any[]).length === 0) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const comment = (rows as any[])[0];
    if (comment.user_no !== userNo) {
      return res.status(403).json({ message: "You can delete only your own comments" });
    }

    await db.query(`DELETE FROM comments WHERE id = ?`, [commentId]);
    res.json({ message: "Comment deleted successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

export default router;
