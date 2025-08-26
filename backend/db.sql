-- DB 생성 시 인코딩 UTF8
CREATE DATABASE project DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;



-- 사용자 테이블
-- PK, 이름, 아이디, 비밀번호(ENC), 이메일, 개인정보 수집이용 동의일, 수정날짜, 생성날짜
CREATE TABLE User(
	user_no INT PRIMARY KEY NOT NULL AUTO_INCREMENT, 
	user_id VARCHAR(20) NOT NULL, 
	user_pw VARCHAR(500) NOT NULL,  
	user_email VARCHAR(100) NOT NULL, 
	user_image BLOB NULL
	user_privacy_consent_at DATETIME NULL, 
	user_update_at DATETIME NULL, 
	user_create_at DATETIME NOT NULL
);



-- 아티클 테이블
-- PK, 제목, 요약, 본문, 이미지, 게시판 분류, 출처, 작성일, 수정일, 좋아요 횟수, 평점 평균, 조회수
CREATE TABLE Article(
    article_no INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
    article_title VARCHAR(255) NOT NULL,
    article_summary VARCHAR(500) NOT NULL,
    article_content TEXT NOT NULL,
    article_image_url VARCHAR(500) NULL,
    article_category VARCHAR(50) NOT NULL,
    article_reg_at DATETIME NOT NULL,
    article_update_at DATETIME NULL,
    article_like_count INT DEFAULT 0,
    article_rate_avg DECIMAL(2, 1) DEFAULT 0.0,
    article_view_count INT DEFAULT 0
);

-- 세줄 요약 테이블
CREATE TABLE DailyDigest (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ref_date DATE NOT NULL,
  category VARCHAR(50) NOT NULL,
  line_no TINYINT NOT NULL,           -- 1,2,3 줄
  article_no INT NOT NULL,
  one_line_summary VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_no) REFERENCES Article(article_no) ON DELETE CASCADE
);

-- 출처 테이블
-- 출처 고유번호, 신문사 이름, 원본 링크
CREATE TABLE Article_Source(
		source_no INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
		press_name VARCHAR(100) UNIQUE NOT NULL,
		source_url TEXT NOT NULL
);

-- 아티클-출처 매핑 테이블
-- 아티클 고유번호, 출처 고유번호
CREATE TABLE Article_Source_Map(
		article_no INT NOT NULL,
		source_no INT NOT NULL,
		PRIMARY KEY (article_no, source_no),
		FOREIGN KEY (article_no) REFERENCES Article(article_no) ON DELETE CASCADE,
		FOREIGN KEY (source_no) REFERENCES Article_Source(source_no) ON DELETE CASCADE
);

-- 북마크 테이블
-- 사용자 고유번호, 아티클 고유번호
CREATE TABLE Article_Bookmark(
    user_no INT NOT NULL,
    article_no INT NOT NULL,
    is_bookmarked BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (user_no, article_no),
    FOREIGN KEY (user_no) REFERENCES User(user_no) ON DELETE CASCADE,
    FOREIGN KEY (article_no) REFERENCES Article(article_no) ON DELETE CASCADE
);

-- 별점 테이블
-- 사용자 고유번호, 아티클 고유번호, 평점
CREATE TABLE Article_Rate(
    user_no INT NOT NULL,
    article_no INT NOT NULL,
    rating_score INT NOT NULL CHECK (rating_score BETWEEN 1 AND 5),
    PRIMARY KEY (user_no, article_no),
    FOREIGN KEY (user_no) REFERENCES User(user_no) ON DELETE CASCADE,
    FOREIGN KEY (article_no) REFERENCES Article(article_no) ON DELETE CASCADE
);

-- 좋아요 테이블
-- 사용자 고유번호, 아티클 고유번호
CREATE TABLE Article_Likes(
    user_no INT NOT NULL,
    article_no INT NOT NULL,
    is_liked BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (user_no, article_no),
    FOREIGN KEY (user_no) REFERENCES User(user_no) ON DELETE CASCADE,
    FOREIGN KEY (article_no) REFERENCES Article(article_no) ON DELETE CASCADE
);




-- 로그인 프로시져

DELIMITER $$

DROP PROCEDURE IF EXISTS WEB_GET_LOGIN$$

CREATE PROCEDURE WEB_GET_LOGIN(
    IN p_user_id VARCHAR(20),    
    IN p_user_pw VARCHAR(500)    
)
BEGIN

    SELECT user_no, user_id
    FROM User
    WHERE user_id = p_user_id AND user_pw = p_user_pw;

END$$

DELIMITER ;



-- 검색용 프로시져
DELIMITER $$

DROP PROCEDURE IF EXISTS WEB_SEARCH_ARTICLES$$

CREATE PROCEDURE WEB_SEARCH_ARTICLES(
    IN p_keyword VARCHAR(255),
    IN p_category VARCHAR(50),
    IN p_searchRange VARCHAR(20),
    IN p_sort VARCHAR(20),
    IN p_startDate DATETIME,
    IN p_endDate DATETIME,
    IN p_limit INT,
    IN p_offset INT
)
BEGIN
    SELECT 
        article_no,
        article_title,
        article_summary,
        article_content,
        article_category,
        article_reg_at,
        article_like_count,
        article_rate_avg
    FROM Article
    WHERE
        -- 검색 범위
        (
            (p_searchRange = 'title' AND article_title LIKE CONCAT('%', p_keyword, '%'))
            OR (p_searchRange = 'content' AND article_content LIKE CONCAT('%', p_keyword, '%'))
            OR (p_searchRange = 'title_content' AND 
                (article_title LIKE CONCAT('%', p_keyword, '%') 
                 OR article_content LIKE CONCAT('%', p_keyword, '%')))
            OR (p_searchRange IS NULL OR p_searchRange = '')
        )
        -- 카테고리 필터
        AND (p_category IS NULL OR p_category = '' OR article_category = p_category)
        -- 날짜 필터
        AND (p_startDate IS NULL OR p_endDate IS NULL 
             OR article_reg_at BETWEEN p_startDate AND p_endDate)
        -- 정렬
    ORDER BY
        CASE 
            WHEN p_sort = 'latest' THEN article_reg_at
            WHEN p_sort = 'popular' THEN article_like_count
            WHEN p_sort = 'rating' THEN article_rate_avg
            ELSE article_reg_at
        END DESC
    LIMIT p_limit OFFSET p_offset;
END$$

DELIMITER ;

 -- 커뮤니티 스키마 (MySQL)
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- 1) 저장소
CREATE TABLE IF NOT EXISTS repositories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) 게시글
CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_no INT NOT NULL,
  repository_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  image_url VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_posts_user FOREIGN KEY (user_no) REFERENCES User(user_no) ON DELETE CASCADE,
  CONSTRAINT fk_posts_repo FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) 게시글 사진(여러 장)
CREATE TABLE IF NOT EXISTS post_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_post_photos_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) 게시글 좋아요
CREATE TABLE IF NOT EXISTS post_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_no INT NOT NULL,
  post_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_post (user_no, post_id),
  CONSTRAINT fk_post_likes_user FOREIGN KEY (user_no) REFERENCES User(user_no) ON DELETE CASCADE,
  CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) 댓글
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_no INT NOT NULL,
  post_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_no) REFERENCES User(user_no) ON DELETE CASCADE,
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6) 팔로우 (유저-유저)
CREATE TABLE IF NOT EXISTS follows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  follower_no INT NOT NULL,
  followee_no INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_follow (follower_no, followee_no),
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_no) REFERENCES User(user_no) ON DELETE CASCADE,
  CONSTRAINT fk_follows_followee FOREIGN KEY (followee_no) REFERENCES User(user_no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;
