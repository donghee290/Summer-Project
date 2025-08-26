"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../db");
const router = (0, express_1.Router)();
/** 1) 전체 게시글 목록 */
router.get("/", async (_req, res) => {
    try {
        const [rows] = await db_1.db.query(`
      SELECT
        p.id, p.title, p.content, p.image_url AS image, u.user_id AS author,
        r.id AS repoId, r.name AS repoName,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments
      FROM posts p
      JOIN repositories r ON r.id = p.repository_id
      JOIN User u ON u.user_no = p.user_no
      ORDER BY p.created_at DESC
    `);
        const data = rows.map(r => ({
            id: r.id,
            title: r.title,
            content: r.content,
            image: r.image || null,
            author: r.author,
            likes: Number(r.likes),
            liked: false,
            comments: Number(r.comments),
            repository: { id: r.repoId, name: r.repoName },
        }));
        res.json(data);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch posts" });
    }
});
/** 2) 게시글 상세 (+ 댓글 목록) */
router.get("/:id", async (req, res) => {
    const postId = Number(req.params.id);
    try {
        const [rows] = await db_1.db.query(`
      SELECT
        p.id, p.title, p.content, p.image_url AS image, u.user_id AS author,
        r.id AS repoId, r.name AS repoName,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes
      FROM posts p
      JOIN repositories r ON r.id = p.repository_id
      JOIN User u ON u.user_no = p.user_no
      WHERE p.id = ?
    `, [postId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Post not found" });
        }
        const r = rows[0];
        const [comments] = await db_1.db.query(`
      SELECT c.id, u.user_id AS user, c.content, DATE_FORMAT(c.created_at, '%Y-%m-%d') AS createdAt
      FROM comments c
      JOIN User u ON u.user_no = c.user_no
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `, [postId]);
        res.json({
            id: r.id,
            title: r.title,
            content: r.content,
            image: r.image,
            author: r.author,
            likes: Number(r.likes),
            liked: false,
            comments: comments.length,
            repository: { id: r.repoId, name: r.repoName },
            commentList: comments,
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch post detail" });
    }
});
/** 3) 게시글 작성 */
router.post("/", async (req, res) => {
    const { repositoryId, title, content, image } = req.body;
    const userNo = 1; // 로그인 연동 전 임시
    if (!repositoryId || !title || !content) {
        return res
            .status(400)
            .json({ message: "repositoryId, title, content are required" });
    }
    try {
        const [result] = await db_1.db.query(`
      INSERT INTO posts (user_no, repository_id, title, content, image_url, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [userNo, repositoryId, title, content, image || null]);
        const insertId = result.insertId;
        const [rows] = await db_1.db.query(`
      SELECT
        p.id, p.title, p.content, p.image_url AS image, u.user_id AS author,
        r.id AS repoId, r.name AS repoName
      FROM posts p
      JOIN repositories r ON r.id = p.repository_id
      JOIN User u ON u.user_no = p.user_no
      WHERE p.id = ?
    `, [insertId]);
        const r = rows[0];
        res.status(201).json({
            id: r.id,
            title: r.title,
            content: r.content,
            image: r.image,
            author: r.author,
            likes: 0,
            liked: false,
            comments: 0,
            repository: { id: r.repoId, name: r.repoName },
        });
    }
    catch (e) {
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
        const [result] = await db_1.db.query(`
      INSERT INTO comments (user_no, post_id, content, created_at)
      VALUES (?, ?, ?, NOW())
    `, [userNo, postId, content.trim()]);
        const insertId = result.insertId;
        const [rows] = await db_1.db.query(`
      SELECT c.id, u.user_id AS user, c.content, DATE_FORMAT(c.created_at, '%Y-%m-%d') AS createdAt
      FROM comments c
      JOIN User u ON u.user_no = c.user_no
      WHERE c.id = ?
    `, [insertId]);
        res.status(201).json(rows[0]);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to create comment" });
    }
});
/** 5) 좋아요 토글 */
router.post("/:id/like", async (req, res) => {
    const postId = Number(req.params.id);
    const userNo = 1; // 로그인 연동 전
    try {
        const [exists] = await db_1.db.query(`SELECT 1 FROM post_likes WHERE user_no = ? AND post_id = ?`, [userNo, postId]);
        if (exists.length) {
            await db_1.db.query(`DELETE FROM post_likes WHERE user_no = ? AND post_id = ?`, [userNo, postId]);
        }
        else {
            await db_1.db.query(`INSERT INTO post_likes (user_no, post_id, created_at) VALUES (?, ?, NOW())`, [userNo, postId]);
        }
        const [cnt] = await db_1.db.query(`SELECT COUNT(*) AS likes FROM post_likes WHERE post_id = ?`, [postId]);
        const likes = Number(cnt[0].likes);
        res.json({ liked: exists.length === 0, likes });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to toggle like" });
    }
});
/** 6) 게시글 삭제 */
router.delete("/:id", async (req, res) => {
    const postId = Number(req.params.id);
    const userNo = 1; // 로그인 연동 전 임시 유저 번호
    try {
        // 본인 글인지 확인
        const [rows] = await db_1.db.query(`SELECT user_no FROM posts WHERE id = ?`, [postId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Post not found" });
        }
        const post = rows[0];
        if (post.user_no !== userNo) {
            return res.status(403).json({ message: "You can delete only your posts" });
        }
        // 삭제 실행
        await db_1.db.query(`DELETE FROM posts WHERE id = ?`, [postId]);
        res.json({ message: "Post deleted successfully" });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to delete post" });
    }
});
exports.default = router;
