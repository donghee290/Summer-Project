const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');

// 네이버 API 인증 정보
const CLIENT_ID = '5cij5EoCu8uziisWyTjY';
const CLIENT_SECRET = '9vwdjrS6ly';

// 대표적인 신문사 8개 도메인
const TARGET_NEWS_SITES = [
    'chosun.com',      // 조선일보
    'joins.com',       // 중앙일보
    'donga.com',       // 동아일보
    'hani.co.kr',      // 한겨레
    'khan.co.kr',      // 경향신문
    'yna.co.kr',       // 연합뉴스
    'ytn.co.kr',       // YTN
    'sbs.co.kr'        // SBS
];

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
    'ytn.co.kr': '.paragraph',
    'sbs.co.kr': '.text_area'
};

// 특정 신문사에서만 뉴스 검색하는 함수
async function searchNewsFromSpecificSites(keyword, display = 100) {
    let allResults = [];
    
    for (const site of TARGET_NEWS_SITES) {
        try {
            const query = `${keyword} site:${site}`;
            console.log(`      "${site}"에서 "${keyword}" 검색 중...`);
            
            const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
                params: {
                    query: query,
                    display: Math.min(display, 100),
                    start: 1,
                    sort: 'date'
                },
                headers: {
                    'X-Naver-Client-Id': CLIENT_ID,
                    'X-Naver-Client-Secret': CLIENT_SECRET
                }
            });
            
            const items = response.data.items || [];
            console.log(`        -> ${items.length}개 발견`);
            allResults = allResults.concat(items);
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
        } catch (error) {
            console.error(`${site}에서 "${keyword}" 검색 중 오류:`, error.message);
        }
    }
    
    return allResults;
}

// 강화된 본문 텍스트 정제 함수
function cleanNewsContent(content) {
    if (!content || content.length < 10) return content;

    content = content.replace(/\s+/g, ' ');
    
    const jsPatterns = [
        /function _flash_removeCallback[\s\S]*?}/g,
        /\/\/ flash 오류를 우회하기 위한 함수 추가[\s\S]*?\/\/ flash 오류를 우회하기 위한 함수 추가/g,
        /function[\s\S]*?{[\s\S]*?}/g,
        /<script[\s\S]*?<\/script>/gi
    ];
    
    const reporterPatterns = [
        /기자\s*[가-힣]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        /연합뉴스.*?기자/g,
        /\[.*?기자\]/g,
        /[가-힣]{2,4}\s*기자/g,
        /\(기자\s*[가-힣]+\)/g,
        /[가-힣]+\s*기자\s*=\s*/g,
        /기자\s*[가-힣]+\s*=/g
    ];
    
    const copyrightPatterns = [
        /ⓒ.*?금지/g,
        /저작권자.*?금지/g,
        /Copyright.*?All rights reserved/gi,
        /무단전재.*?금지/g,
        /무단.*?배포.*?금지/g,
        /재배포.*?금지/g,
        /All Rights Reserved/gi
    ];
    
    const adPatterns = [
        /\[광고\]/g,
        /\[AD\]/gi,
        /\[홍보\]/g,
        /제공[:：]\s*[가-힣A-Za-z0-9\s]+/g,
        /협찬.*?제공/g,
        /스폰서.*?제공/g,
        /후원.*?제공/g
    ];
    
    const linkPatterns = [
        /관련기사/g,
        /▶.*?바로가기/g,
        />>.*?클릭/g,
        /더보기.*?클릭/g,
        /자세히.*?보기/g,
        /계속.*?읽기/g,
        /전체.*?기사/g
    ];
    
    const socialPatterns = [
        /페이스북\s*트위터\s*카카오스토리/g,
        /공유하기\s*스크랩/g,
        /좋아요\s*공유\s*댓글/g,
        /트위터\s*페이스북/g,
        /카카오톡\s*공유/g,
        /소셜미디어\s*공유/g
    ];
    
    const platformPatterns = [
        /네이버에서도 확인해보세요/g,
        /이 기사를.*?추천합니다/g,
        /동영상 뉴스/g,
        /포토 뉴스/g,
        /실시간 뉴스/g,
        /속보.*?뉴스/g,
        /라이브.*?뉴스/g
    ];
    
    const subscriptionPatterns = [
        /구독.*?알림/g,
        /팔로우.*?알림/g,
        /뉴스레터.*?구독/g,
        /알림.*?설정/g,
        /구독.*?신청/g
    ];
    
    const captionPatterns = [
        /\[사진=.*?\]/g,
        /\[영상=.*?\]/g,
        /\[그래픽=.*?\]/g,
        /\[자료=.*?\]/g,
        /\[출처=.*?\]/g,
        /편집자주.*?$/gm,
        /※.*?$/gm,
        /★.*?$/gm
    ];
    
    const locationPatterns = [
        /\(.*?=.*?연합뉴스\)/g,
        /\(서울=.*?\)/g,
        /\(부산=.*?\)/g,
        /\(대구=.*?\)/g,
        /\(광주=.*?\)/g,
        /\(대전=.*?\)/g,
        /\(인천=.*?\)/g,
        /\([가-힣]+=.*?\)/g
    ];
    
    const timePatterns = [
        /\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*\d{1,2}시\s*\d{1,2}분/g,
        /\d{1,2}:\d{2}.*?업데이트/g,
        /최종.*?수정/g,
        /입력.*?\d{4}-\d{2}-\d{2}/g
    ];

    const allPatterns = [
        ...jsPatterns,
        ...reporterPatterns,
        ...copyrightPatterns,
        ...adPatterns,
        ...linkPatterns,
        ...socialPatterns,
        ...platformPatterns,
        ...subscriptionPatterns,
        ...captionPatterns,
        ...locationPatterns,
        ...timePatterns
    ];
    
    for (const pattern of allPatterns) {
        content = content.replace(pattern, '');
    }
    
    content = content.replace(/^[^\w가-힣]+|[^\w가-힣.!?]+$/g, '');
    
    content = content.replace(/\.{3,}/g, '...')
                    .replace(/[!?]{2,}/g, '!')
                    .replace(/-{2,}/g, '-')
                    .replace(/={2,}/g, '=')
                    .replace(/\*{2,}/g, '*');
    
    content = content.replace(/\s{2,}/g, ' ')
                    .replace(/\n\s*\n/g, '\n')
                    .trim();
    
    return content;
}

// 광고성 내용 검증 함수
function isAdvertisementContent(content) {
    const adKeywords = ['광고', '할인', '이벤트', '쿠폰', '혜택', '특가', '세일', '프로모션', 
                       '무료', '증정', '당첨', '응모', '참여', '신청'];
    const adCount = adKeywords.reduce((count, keyword) => 
        count + (content.split(keyword).length - 1), 0);
    
    const adRatio = adCount / (content.length / 100);
    return adRatio > 0.5 || adCount > 5;
}

// 품질 검증 함수
function validateContentQuality(content) {
    if (!content || content.length < 50) {
        return { isValid: false, reason: '본문이 너무 짧습니다.' };
    }
    
    if (isAdvertisementContent(content)) {
        return { isValid: false, reason: '광고성 내용이 많이 포함되어 있습니다.' };
    }
    
    const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 10);
    if (sentences.length < 3) {
        return { isValid: false, reason: '의미있는 문장이 부족합니다.' };
    }
    
    const koreanChars = content.match(/[가-힣]/g);
    const koreanRatio = koreanChars ? koreanChars.length / content.length : 0;
    if (koreanRatio < 0.3) {
        return { isValid: false, reason: '한글 비율이 너무 낮습니다.' };
    }
    
    return { isValid: true, reason: 'OK' };
}

// 개선된 뉴스 본문 크롤링 함수
async function getNewsContent(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);
        let content = '';

        const domain = new URL(url).hostname;
        const specificSelector = siteSpecificSelectors[domain];
        
        if (specificSelector) {
            const specificElement = $(specificSelector);
            if (specificElement.length > 0) {
                specificElement.find('script, style, .ad, .advertisement, .related, .tag, .btn, button, .share, .social, .comment, .reply').remove();
                specificElement.find('[class*="ad"], [class*="banner"], [id*="ad"], [id*="banner"]').remove();
                specificElement.find('.journalist, .reporter, .copyright, .source, .byline').remove();
                specificElement.find('.nav, .navigation, .menu, .sidebar').remove();
                
                content = specificElement.text().trim();
            }
        }

        if (!content || content.length < 100) {
            if (url.includes('news.naver.com')) {
                const selectors = [
                    '#newsct_article',
                    '#articleBodyContents',
                    '.se_component_wrap',
                    '#articeBody',
                    '.article_body'
                ];

                for (const selector of selectors) {
                    const element = $(selector);
                    if (element.length > 0) {
                        element.find('script, style, .ad, .advertisement, .related, .tag, .btn, button, .share, .social, .comment, .reply').remove();
                        element.find('[class*="ad"], [class*="banner"], [id*="ad"], [id*="banner"]').remove();
                        element.find('.journalist, .reporter, .copyright, .source, .byline').remove();
                        
                        content = element.text().trim();
                        if (content.length > 100) break;
                    }
                }
            } else {
                const commonSelectors = [
                    'article',
                    '.article-content',
                    '.news-content',
                    '.article_body',
                    '#article-view-content-div',
                    '.view_txt',
                    '.article-text',
                    '.content',
                    '.post-content',
                    '.entry-content'
                ];

                for (const selector of commonSelectors) {
                    const element = $(selector);
                    if (element.length > 0) {
                        element.find('script, style, .ad, .advertisement, .related, .tag, .btn, button, .share, .social, .comment, .reply').remove();
                        element.find('[class*="ad"], [class*="banner"], [id*="ad"], [id*="banner"]').remove();
                        element.find('.journalist, .reporter, .copyright, .source, .byline').remove();
                        
                        content = element.text().trim();
                        if (content.length > 100) break;
                    }
                }
            }
        }

        if (content) {
            content = cleanNewsContent(content);
            
            const validation = validateContentQuality(content);
            if (!validation.isValid) {
                return validation.reason;
            }
        }

        return content || '본문을 가져올 수 없습니다.';

    } catch (error) {
        console.error(`본문 크롤링 오류 (${url}):`, error.message);
        return '본문 크롤링 실패';
    }
}

// 1시간 이내 뉴스 필터링 함수
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
    return text.replace(/<[^>]*>/g, '')
               .replace(/&quot;/g, '"')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&nbsp;/g, ' ')
               .replace(/&#39;/g, "'");
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

// 신문사별 통계를 위한 함수
function getNewsSiteFromUrl(url) {
    try {
        const hostname = new URL(url).hostname;
        return TARGET_NEWS_SITES.find(site => hostname.includes(site)) || 'other';
    } catch {
        return 'unknown';
    }
}

// 카테고리별 뉴스 수집 함수
async function collectNewsByCategory(category, keywords) {
    console.log(`\n${category} 카테고리 뉴스 수집 중...`);
    let allNews = [];
    
    for (const keyword of keywords) {
        console.log(`  - "${keyword}" 검색 중 (대상: ${TARGET_NEWS_SITES.length}개 신문사):`);
        const newsItems = await searchNewsFromSpecificSites(keyword);
        allNews = allNews.concat(newsItems);
    }
    
    console.log(`  -> 총 ${allNews.length}개 기사 발견`);
    
    allNews = removeDuplicates(allNews);
    console.log(`  -> 중복 제거 후: ${allNews.length}개`);
    
    const recentNews = filterRecentNews(allNews);
    console.log(`  -> 최근 1시간 내: ${recentNews.length}개`);
    
    const siteCounts = {};
    recentNews.forEach(item => {
        const site = getNewsSiteFromUrl(item.link);
        siteCounts[site] = (siteCounts[site] || 0) + 1;
    });
    
    console.log(`  -> 신문사별 분포:`);
    TARGET_NEWS_SITES.forEach(site => {
        const count = siteCounts[site] || 0;
        console.log(`     - ${site}: ${count}개`);
    });
    
    console.log(`  -> 본문 크롤링 및 정제 시작...`);
    
    const newsWithContent = [];
    let successCount = 0;
    let qualityCount = 0;
    let failureReasons = {};
    
    for (let i = 0; i < recentNews.length; i++) {
        const item = recentNews[i];
        const originalUrl = item.link;
        const naverUrl = generateNaverNewsUrl(originalUrl);
        const newsSite = getNewsSiteFromUrl(originalUrl);
        
        const urlToFetch = naverUrl || originalUrl;
        
        console.log(`    [${i + 1}/${recentNews.length}] "${stripHtmlTags(item.title).substring(0, 30)}..." (${newsSite}) 처리 중`);
        
        const content = await getNewsContent(urlToFetch);
        
        let isQualityContent = false;
        let contentStatus = 'failed';
        
        if (content && 
            !['본문을 가져올 수 없습니다.', '본문 크롤링 실패', '본문이 너무 짧습니다.', 
              '광고성 내용이 많이 포함되어 있습니다.', '의미있는 문장이 부족합니다.',
              '한글 비율이 너무 낮습니다.'].includes(content)) {
            successCount++;
            contentStatus = 'success';
            
            if (content.length > 500) {
                qualityCount++;
                isQualityContent = true;
                contentStatus = 'quality';
            }
        } else {
            failureReasons[content] = (failureReasons[content] || 0) + 1;
        }
        
        newsWithContent.push({
            title: stripHtmlTags(item.title),
            originalUrl: originalUrl,
            naverUrl: naverUrl,
            newsSite: newsSite,
            description: stripHtmlTags(item.description),
            pubDate: item.pubDate,
            category: category,
            content: content,
            contentLength: content ? content.length : 0,
            contentStatus: contentStatus,
            isQualityContent: isQualityContent
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`  -> 본문 수집 완료: ${successCount}/${recentNews.length}개 성공 (양질: ${qualityCount}개)`);
    
    if (Object.keys(failureReasons).length > 0) {
        console.log(`  -> 실패 이유별 통계:`);
        for (const [reason, count] of Object.entries(failureReasons)) {
            console.log(`     - ${reason}: ${count}개`);
        }
    }
    
    return newsWithContent;
}

// 메인 실행 함수
async function main() {
    console.log('=== 특정 신문사 8개 대상 네이버 뉴스 수집기 ===');
    console.log(`대상 신문사: ${TARGET_NEWS_SITES.join(', ')}`);
    console.log('최근 1시간 내 뉴스를 카테고리별로 수집하고 강화된 정제 로직을 적용합니다.\n');
    
    const startTime = Date.now();
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
        const successCount = Object.values(collectedNews).reduce((sum, news) => 
            sum + news.filter(item => item.contentStatus === 'success' || item.contentStatus === 'quality').length, 0);
        const qualityCount = Object.values(collectedNews).reduce((sum, news) => 
            sum + news.filter(item => item.isQualityContent).length, 0);
        
        const overallSiteCounts = {};
        Object.values(collectedNews).flat().forEach(item => {
            overallSiteCounts[item.newsSite] = (overallSiteCounts[item.newsSite] || 0) + 1;
        });
        
        const executionTime = Math.round((Date.now() - startTime) / 1000);
        
        console.log('\n=== 최종 수집 결과 요약 ===');
        console.log(`실행 시간: ${executionTime}초`);
        console.log(`경제: ${collectedNews.economy.length}개`);
        console.log(`사회: ${collectedNews.society.length}개`);
        console.log(`연예: ${collectedNews.entertainment.length}개`);
        console.log(`총 수집: ${totalCount}개`);
        console.log(`본문 성공: ${successCount}개 (${Math.round(successCount/totalCount*100)}%)`);
        console.log(`양질 콘텐츠: ${qualityCount}개 (${Math.round(qualityCount/totalCount*100)}%)`);
        
        console.log('\n=== 신문사별 최종 통계 ===');
        TARGET_NEWS_SITES.forEach(site => {
            const count = overallSiteCounts[site] || 0;
            console.log(`${site}: ${count}개`);
        });
        
        // 완전히 수정된 부분: 올바른 JavaScript 객체 구조
        const result = {
            metadata: {
                collectedAt: new Date().toISOString(),
                timeRange: '최근 1시간',
                targetNewsSites: TARGET_NEWS_SITES,
                executionTimeSeconds: executionTime,
                totalCount: totalCount,
                successCount: successCount,
                qualityCount: qualityCount,
                successRate: Math.round(successCount/totalCount*100),
                qualityRate: Math.round(qualityCount/totalCount*100),
                siteDistribution: overallSiteCounts
            },
            categories: {
                economy: collectedNews.economy.length,
                society: collectedNews.society.length,
                entertainment: collectedNews.entertainment.length
            },
            news: collectedNews
        };
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `naver_news_8sites_${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify(result, null, 2), 'utf8');
        console.log(`\n특정 신문사 8개 대상 뉴스 데이터가 "${filename}"에 저장되었습니다.`);
        
    } catch (error) {
        console.error('뉴스 수집 중 오류가 발생했습니다:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { 
    searchNewsFromSpecificSites,
    collectNewsByCategory, 
    filterRecentNews, 
    getNewsContent, 
    cleanNewsContent,
    validateContentQuality,
    TARGET_NEWS_SITES
};

