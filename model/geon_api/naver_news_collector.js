require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');

// 카테고리별 검색 키워드 정의
const KEYWORDS = {
    economy: ['경제', '금융', '주식', '부동산', '기업', '경기', '투자', '증시'],
    society: ['사회', '정치', '법원', '검찰', '사건', '사고', '교육', '복지'],
    entertainment: ['연예', '연예인', '방송', '영화', '드라마', '음악', 'K-pop', '스타']
};

// 네이버 뉴스 검색 함수
async function searchNews(keyword, display = 100) {
    try {
        const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params: {
                query: keyword,
                display: display,
                start: 1,
                sort: 'date'
            },
            headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
            }
        });
        return response.data.items || [];
    } catch (error) {
        console.error(`키워드 "${keyword}" 검색 중 오류:`, error.message);
        return [];
    }
}

// 뉴스 본문 크롤링 함수
async function getNewsContent(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        let content = '';

        // 네이버 뉴스 페이지인 경우
        if (url.includes('news.naver.com')) {
            const selectors = [
                '#newsct_article',
                '#articleBodyContents',
                '.se_component_wrap',
                '#articeBody'
            ];

            for (const selector of selectors) {
                const element = $(selector);
                if (element.length > 0) {
                    content = element.text().trim();
                    // 불필요한 텍스트 제거 (수정된 부분)
                    content = content.replace(/\s+/g, ' ')
                                   .replace(/function _flash_removeCallback[\s\S]*?}/g, '')
                                   .replace(/\/\/ flash 오류를 우회하기 위한 함수 추가[\s\S]*?\/\/ flash 오류를 우회하기 위한 함수 추가/g, '')
                                   .trim();
                    break;
                }
            }
        } else {
            // 원본 언론사 페이지의 경우 일반적인 선택자들 시도
            const commonSelectors = [
                'article',
                '.article-content',
                '.news-content',
                '.article_body',
                '#article-view-content-div',
                '.view_txt'
            ];

            for (const selector of commonSelectors) {
                const element = $(selector);
                if (element.length > 0) {
                    content = element.text().trim();
                    if (content.length > 100) {
                        content = content.replace(/\s+/g, ' ').trim();
                        break;
                    }
                }
            }
        }

        return content || '본문을 가져올 수 없습니다.';

    } catch (error) {
        console.error(`본문 크롤링 오류 (${url}):`, error.message);
        return '본문 크롤링 실패';
    }
}

// 2시간 이내 뉴스 필터링 함수
function filterRecentNews(newsItems, hoursBack = 2) {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000));
    
    return newsItems.filter(item => {
        const pubDate = new Date(item.pubDate);
        return pubDate >= twoHoursAgo;
    });
}

// 중복 제거 함수
function removeDuplicates(newsArray) {
    const seen = new Set();
    return newsArray.filter(item => {
        if (seen.has(item.link)) {
            return false;
        }
        seen.add(item.link);
        return true;
    });
}

// HTML 태그 제거 함수
function stripHtmlTags(text) {
    return text.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// 네이버 뉴스 URL 생성 함수
function generateNaverNewsUrl(originalUrl) {
    if (originalUrl.includes('news.naver.com')) {
        return originalUrl;
    }
    
    const oidMatch = originalUrl.match(/oid=(\d+)/);
    const aidMatch = originalUrl.match(/aid=(\d+)/);
    
    if (oidMatch && aidMatch) {
        return `https://news.naver.com/main/read.naver?oid=${oidMatch[1]}&aid=${aidMatch[1]}`;
    }
    
    return null;
}

// 카테고리별 뉴스 수집 함수 (본문 포함)
async function collectNewsByCategory(category, keywords) {
    console.log(`\n${category} 카테고리 뉴스 수집 중...`);
    let allNews = [];
    
    for (const keyword of keywords) {
        console.log(`  - "${keyword}" 검색 중...`);
        const newsItems = await searchNews(keyword);
        allNews = allNews.concat(newsItems);
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    allNews = removeDuplicates(allNews);
    const recentNews = filterRecentNews(allNews);
    
    console.log(`  -> ${recentNews.length}개의 최근 2시간 내 뉴스 발견`);
    console.log(`  -> 본문 크롤링 시작...`);
    
    const newsWithContent = [];
    let successCount = 0;
    
    for (let i = 0; i < recentNews.length; i++) {
        const item = recentNews[i];
        const originalUrl = item.link;
        const naverUrl = generateNaverNewsUrl(originalUrl);
        
        const urlToFetch = naverUrl || originalUrl;
        
        console.log(`    [${i + 1}/${recentNews.length}] 본문 수집 중...`);
        
        const content = await getNewsContent(urlToFetch);
        
        if (content && content !== '본문을 가져올 수 없습니다.' && content !== '본문 크롤링 실패') {
            successCount++;
        }
        
        newsWithContent.push({
            title: stripHtmlTags(item.title),
            originalUrl: originalUrl,
            naverUrl: naverUrl,
            description: stripHtmlTags(item.description),
            pubDate: item.pubDate,
            category: category,
            content: content
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`  -> 본문 수집 완료: ${successCount}/${recentNews.length}개 성공`);
    return newsWithContent;
}

// 메인 실행 함수
async function main() {
    console.log('=== 네이버 뉴스 수집기 실행 (본문 포함) ===');
    console.log('최근 2시간 내 뉴스를 카테고리별로 수집하고 본문을 크롤링합니다.\n');
    
    const collectedNews = {
        economy: [],
        society: [],
        entertainment: []
    };
    
    try {
        for (const [category, keywords] of Object.entries(KEYWORDS)) {
            collectedNews[category] = await collectNewsByCategory(category, keywords);
        }
        
        const totalCount = Object.values(collectedNews).reduce((sum, news) => sum + news.length, 0);
        const contentSuccessCount = Object.values(collectedNews).reduce((sum, news) => 
            sum + news.filter(item => item.content && 
                item.content !== '본문을 가져올 수 없습니다.' && 
                item.content !== '본문 크롤링 실패').length, 0);
        
        console.log('\n=== 수집 결과 요약 ===');
        console.log(`경제: ${collectedNews.economy.length}개`);
        console.log(`사회: ${collectedNews.society.length}개`);
        console.log(`연예: ${collectedNews.entertainment.length}개`);
        console.log(`총합: ${totalCount}개`);
        console.log(`본문 수집 성공: ${contentSuccessCount}개`);
        
        const result = {
            collectedAt: new Date().toISOString(),
            timeRange: '최근 2시간',
            totalCount: totalCount,
            contentSuccessCount: contentSuccessCount,
            categories: {
                economy: collectedNews.economy.length,
                society: collectedNews.society.length,
                entertainment: collectedNews.entertainment.length
            },
            news: collectedNews
        };
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `naver_news_with_content_${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify(result, null, 2), 'utf8');
        console.log(`\n뉴스 데이터(본문 포함)가 "${filename}" 파일로 저장되었습니다.`);
        
    } catch (error) {
        console.error('뉴스 수집 중 오류가 발생했습니다:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { searchNews, collectNewsByCategory, filterRecentNews, getNewsContent };

