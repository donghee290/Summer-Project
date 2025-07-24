const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');

// 네이버 API 인증 정보
const CLIENT_ID = '5cij5EoCu8uziisWyTjY';
const CLIENT_SECRET = '9vwdjrS6ly';

// 카테고리별 검색 키워드 정의
const KEYWORDS = {
    economy: ['경제', '금융', '주식', '부동산', '기업', '경기', '투자', '증시'],
    society: ['사회', '정치', '법원', '검찰', '사건', '사고', '교육', '복지'],
    entertainment: ['연예', '연예인', '방송', '영화', '드라마', '음악', 'K-pop', '스타']
};

// 주요 언론사별 최적화된 선택자
const siteSpecificSelectors = {
    'chosun.com': '.news_text',
    'joins.com': '#article_body',
    'donga.com': '.article_txt',
    'hani.co.kr': '.text',
    'khan.co.kr': '#articleBody',
    'yna.co.kr': '.article-text',
    'ytn.co.kr': '.paragraph'
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
                'X-Naver-Client-Id': CLIENT_ID,
                'X-Naver-Client-Secret': CLIENT_SECRET
            }
        });
        return response.data.items || [];
    } catch (error) {
        console.error(`키워드 "${keyword}" 검색 중 오류:`, error.message);
        return [];
    }
}

// 본문 텍스트 정제 함수
function cleanNewsContent(content) {
    if (!content || content.length < 10) return content;

    // 연속된 공백을 하나로 통합
    content = content.replace(/\s+/g, ' ');
    
    // 불필요한 패턴들 제거
    const unnecessaryPatterns = [
        // JavaScript 관련
        /function _flash_removeCallback[\s\S]*?}/g,
        /\/\/ flash 오류를 우회하기 위한 함수 추가[\s\S]*?\/\/ flash 오류를 우회하기 위한 함수 추가/g,
        
        // 기자 정보
        /기자\s*[가-힣]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        /연합뉴스.*?기자/g,
        /\[.*?기자\]/g,
        /[가-힣]{2,4}\s*기자/g,
        
        // 저작권 관련
        /ⓒ.*?무단.*?금지/g,
        /저작권자.*?무단.*?배포.*?금지/g,
        /Copyright.*?All rights reserved/gi,
        /무단전재.*?재배포.*?금지/g,
        
        // 광고 관련
        /\[광고\]/g,
        /\[AD\]/gi,
        /제공[:：]\s*[가-힣A-Za-z0-9]+/g,
        /협찬.*?제공/g,
        
        // 관련 기사 링크
        /관련기사/g,
        /▶.*?바로가기/g,
        />>.*?클릭/g,
        /더보기.*?클릭/g,
        
        // 소셜 미디어 관련
        /페이스북\s*트위터\s*카카오스토리/g,
        /공유하기\s*스크랩/g,
        /좋아요\s*공유\s*댓글/g,
        
        // 뉴스 플랫폼 관련
        /네이버에서도 확인해보세요/g,
        /이 기사를.*?추천합니다/g,
        /동영상 뉴스/g,
        /포토 뉴스/g,
        /실시간 뉴스/g,
        
        // 구독 및 알림 관련
        /구독.*?알림/g,
        /팔로우.*?알림/g,
        /뉴스레터.*?구독/g,
        
        // 기타 불필요한 텍스트
        /\[사진=.*?\]/g,
        /\[영상=.*?\]/g,
        /편집자주.*?$/gm,
        /※.*?$/gm
    ];
    
    // 패턴들을 순차적으로 제거
    for (const pattern of unnecessaryPatterns) {
        content = content.replace(pattern, '');
    }
    
    // 문장 시작과 끝의 불필요한 문자 제거
    content = content.replace(/^[^\w가-힣]+|[^\w가-힣.!?]+$/g, '');
    
    // 연속된 마침표나 특수문자 정리
    content = content.replace(/\.{3,}/g, '...');
    content = content.replace(/[!?]{2,}/g, '!');
    
    // 최종 공백 정리
    content = content.replace(/\s{2,}/g, ' ').trim();
    
    return content;
}

// 광고성 내용 검증 함수
function isAdvertisementContent(content) {
    const adKeywords = ['광고', '할인', '이벤트', '쿠폰', '혜택', '특가', '세일', '프로모션'];
    const adCount = adKeywords.reduce((count, keyword) => 
        count + (content.split(keyword).length - 1), 0);
    
    return adCount > 3;
}

// 개선된 뉴스 본문 크롤링 함수
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

        // 사이트별 맞춤 선택자 시도
        const domain = new URL(url).hostname;
        const specificSelector = siteSpecificSelectors[domain];
        
        if (specificSelector) {
            const specificElement = $(specificSelector);
            if (specificElement.length > 0) {
                // 불필요한 요소들 제거
                specificElement.find('script, style, .ad, .advertisement, .related, .tag, .btn, button, .share, .social').remove();
                specificElement.find('[class*="ad"], [class*="banner"], [id*="ad"], [id*="banner"]').remove();
                specificElement.find('.journalist, .reporter, .copyright, .source').remove();
                
                content = specificElement.text().trim();
            }
        }

        // 사이트별 선택자로 못 찾았을 경우 일반적인 방법 시도
        if (!content) {
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
                        // 불필요한 요소들 제거
                        element.find('script, style, .ad, .advertisement, .related, .tag, .btn, button, .share, .social').remove();
                        element.find('[class*="ad"], [class*="banner"], [id*="ad"], [id*="banner"]').remove();
                        element.find('.journalist, .reporter, .copyright, .source').remove();
                        
                        content = element.text().trim();
                        break;
                    }
                }
            } else {
                // 원본 언론사 페이지의 경우
                const commonSelectors = [
                    'article',
                    '.article-content',
                    '.news-content',
                    '.article_body',
                    '#article-view-content-div',
                    '.view_txt',
                    '.article-text'
                ];

                for (const selector of commonSelectors) {
                    const element = $(selector);
                    if (element.length > 0) {
                        // 불필요한 요소들 제거
                        element.find('script, style, .ad, .advertisement, .related, .tag, .btn, button, .share, .social').remove();
                        element.find('[class*="ad"], [class*="banner"], [id*="ad"], [id*="banner"]').remove();
                        element.find('.journalist, .reporter, .copyright, .source').remove();
                        
                        content = element.text().trim();
                        if (content.length > 100) {
                            break;
                        }
                    }
                }
            }
        }

        // 텍스트 정제
        if (content) {
            content = cleanNewsContent(content);
            
            // 너무 짧은 본문은 제외
            if (content.length < 200) {
                return '본문이 너무 짧습니다.';
            }
            
            // 광고성 내용이 많은 경우 제외
            if (isAdvertisementContent(content)) {
                return '광고성 내용이 많이 포함되어 있습니다.';
            }
        }

        return content || '본문을 가져올 수 없습니다.';

    } catch (error) {
        console.error(`본문 크롤링 오류 (${url}):`, error.message);
        return '본문 크롤링 실패';
    }
}

// 1시간 이내 뉴스 필터링 함수 (2시간에서 1시간으로 변경)
function filterRecentNews(newsItems, hoursBack = 1) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000));
    
    return newsItems.filter(item => {
        const pubDate = new Date(item.pubDate);
        return pubDate >= oneHourAgo;
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
    
    console.log(`  -> ${recentNews.length}개의 최근 1시간 내 뉴스 발견`);
    console.log(`  -> 본문 크롤링 시작...`);
    
    const newsWithContent = [];
    let successCount = 0;
    let qualityCount = 0;
    
    for (let i = 0; i < recentNews.length; i++) {
        const item = recentNews[i];
        const originalUrl = item.link;
        const naverUrl = generateNaverNewsUrl(originalUrl);
        
        const urlToFetch = naverUrl || originalUrl;
        
        console.log(`    [${i + 1}/${recentNews.length}] 본문 수집 중...`);
        
        const content = await getNewsContent(urlToFetch);
        
        let isQualityContent = false;
        if (content && 
            content !== '본문을 가져올 수 없습니다.' && 
            content !== '본문 크롤링 실패' &&
            content !== '본문이 너무 짧습니다.' &&
            content !== '광고성 내용이 많이 포함되어 있습니다.') {
            successCount++;
            if (content.length > 500) { // 충분한 길이의 양질 컨텐츠
                qualityCount++;
                isQualityContent = true;
            }
        }
        
        newsWithContent.push({
            title: stripHtmlTags(item.title),
            originalUrl: originalUrl,
            naverUrl: naverUrl,
            description: stripHtmlTags(item.description),
            pubDate: item.pubDate,
            category: category,
            content: content,
            contentLength: content ? content.length : 0,
            isQualityContent: isQualityContent
        });
        
        // 크롤링 간격 조절 (1초 대기)
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`  -> 본문 수집 완료: ${successCount}/${recentNews.length}개 성공 (양질 콘텐츠: ${qualityCount}개)`);
    return newsWithContent;
}

// 메인 실행 함수
async function main() {
    console.log('=== 네이버 뉴스 수집기 실행 (최근 1시간 + 텍스트 정제) ===');
    console.log('최근 1시간 내 뉴스를 카테고리별로 수집하고 정제된 본문을 크롤링합니다.\n');
    
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
                item.content !== '본문 크롤링 실패' &&
                item.content !== '본문이 너무 짧습니다.' &&
                item.content !== '광고성 내용이 많이 포함되어 있습니다.').length, 0);
        
        const qualityContentCount = Object.values(collectedNews).reduce((sum, news) => 
            sum + news.filter(item => item.isQualityContent).length, 0);
        
        console.log('\n=== 수집 결과 요약 ===');
        console.log(`경제: ${collectedNews.economy.length}개`);
        console.log(`사회: ${collectedNews.society.length}개`);
        console.log(`연예: ${collectedNews.entertainment.length}개`);
        console.log(`총합: ${totalCount}개`);
        console.log(`본문 수집 성공: ${contentSuccessCount}개`);
        console.log(`양질 콘텐츠: ${qualityContentCount}개`);
        
        const result = {
            collectedAt: new Date().toISOString(),
            timeRange: '최근 1시간',
            totalCount: totalCount,
            contentSuccessCount: contentSuccessCount,
            qualityContentCount: qualityContentCount,
            categories: {
                economy: collectedNews.economy.length,
                society: collectedNews.society.length,
                entertainment: collectedNews.entertainment.length
            },
            news: collectedNews
        };
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `naver_news_cleaned_1hour_${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify(result, null, 2), 'utf8');
        console.log(`\n정제된 뉴스 데이터가 "${filename}" 파일로 저장되었습니다.`);
        
    } catch (error) {
        console.error('뉴스 수집 중 오류가 발생했습니다:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { 
    searchNews, 
    collectNewsByCategory, 
    filterRecentNews, 
    getNewsContent, 
    cleanNewsContent 
};

