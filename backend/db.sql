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
-- PK, 제목, 요약, 본문, 이미지, 분류, 신문사, 원본, 작성자, 작성일, 수정일
-- # TODO
-- 논의 및 확인 필요 (Naver API에서 어떤 값들을 제공하는지 확인해봐야 함)
CREATE TABLE Article(
    article_no INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
    article_title VARCHAR(255) NOT NULL,
    article_summary VARCHAR(500) NULL,  -- 세줄요약
    article_content TEXT NOT NULL,  -- 본문 내용
    article_image BLOB NULL, 
    article_category VARCHAR(50) NULL,
    article_source TEXT NOT NULL, 
    -- article_author VARCHAR(100) NULL, 
    article_reg_at DATETIME NOT NULL,  -- 작성일
    article_update_at DATETIME NOT NULL,  -- 수정일
    article_like_count INT DEFAULT 0,
    article_rating_avg DECIMAL(2, 1) DEFAULT 0.0,
    article_view_count INT DEFAULT 0
);
-- 좋아요 수, 평점 평균, 조회수 컬럼 추가 작성자 삭제


-- 북마크 테이블
-- 사용자 고유번호, 아티클 고유번호
CREATE TABLE Bookmark(
    user_no INT NOT NULL,
    article_no INT NOT NULL,
    bookmark_reg_at DATETIME NOT NULL,
    PRIMARY KEY (user_no, article_no),
    FOREIGN KEY (user_no) REFERENCES User(user_no) ON DELETE CASCADE,
    FOREIGN KEY (article_no) REFERENCES Article(article_no) ON DELETE CASCADE
);



-- 별점 테이블
-- 사용자 고유번호, 아티클 고유번호, 평점
CREATE TABLE Rating(
    user_no INT NOT NULL,
    article_no INT NOT NULL,
    rating_score INT NOT NULL,
    PRIMARY KEY (user_no, article_no),
    FOREIGN KEY (user_no) REFERENCES User(user_no) ON DELETE CASCADE,
    FOREIGN KEY (article_no) REFERENCES Article(article_no) ON DELETE CASCADE
);



-- 좋아요 테이블
-- 사용자 고유번호, 아티클 고유번호
CREATE TABLE Likes(
    user_no INT NOT NULL,
    article_no INT NOT NULL,
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
        article_rating_avg
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
    ORDER BY
        CASE 
            WHEN p_sort = 'latest' THEN article_reg_at
            WHEN p_sort = 'popular' THEN article_like_count
            WHEN p_sort = 'rating' THEN article_rating_avg
            ELSE article_reg_at
        END DESC
    LIMIT p_limit OFFSET p_offset;
END$$

DELIMITER ;