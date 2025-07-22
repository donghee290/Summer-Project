const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 네이버 API 설정
const CLIENT_ID = '5cij5EoCu8uziisWyTjY';
const CLIENT_SECRET = '9vwdjrS6ly';
const BASE_URL = 'https://openapi.naver.com/v1/search/news.json';

// 날짜 계산 함수
function getTargetDate() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    return {
        today: formatDate(today),
        yesterday: formatDate(yesterday),
        todayObj: today,
        yesterdayObj: yesterday
    };
}

// HTML 태그 및 특수문자 제거
function cleanText(text) {
    if (!text) return '';
    
    return text
        .replace(/<[^>]*>/g, '')           // HTML 태그 제거
        .replace(/&quot;/g, '"')          // HTML 엔티티 변환
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/[\r\n\t]/g, ' ')        // 개행문자 공백으로 변환
        .replace(/\s+/g, ' ')             // 연속 공백 하나로 변환
        .trim();
}

// 네이버 API 호출
async function callNaverNewsAPI(query, start = 1, display = 100, sort = 'date') {
    try {
        console.log(`📡 API 호출: "${query}" (${start}~${start + display - 1})`);
        
        const response = await axios.get(BASE_URL, {
            params: {
                query: query,
                display: display,
                start: start,
                sort: sort // 'date' 또는 'sim'
            },
            headers: {
                'X-Naver-Client-Id': CLIENT_ID,
                'X-Naver-Client-Secret': CLIENT_SECRET
            }
        });
        
        console.log(`✅ 응답: ${response.data.total}개 중 ${response.data.items?.length}개 수집`);
        return response.data;
        
    } catch (error) {
        if (error.response) {
            console.error(`❌ API 오류: ${error.response.status}`, error.response.data);
        } else {
            console.error('❌ 네트워크 오류:', error.message);
        }
        throw error;
    }
}

// 날짜별 뉴스 필터링
function filterNewsByDate(articles, targetDate) {
    return articles.filter(article => {
        const pubDate = new Date(article.pubDate);
        const articleDate = pubDate.toISOString().split('T')[0];
        return articleDate === targetDate;
    });
}

// 중복 제거 함수
function removeDuplicates(articles) {
    const seen = new Set();
    const uniqueArticles = [];
    
    articles.forEach(article => {
        const title = cleanText(article.title);
        const link = article.originallink || article.link;
        const uniqueKey = `${title}-${link}`;
        
        if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            uniqueArticles.push(article);
        }
    });
    
    return uniqueArticles;
}

// 경제 뉴스 대량 수집 함수
async function collectEconomicNews(maxArticles = 1000) {
    console.log('💰 경제 뉴스 수집을 시작합니다...\n');
    
    const dateInfo = getTargetDate();
    console.log(`📅 수집 날짜: ${dateInfo.yesterday} (어제)`);
    console.log(`📅 오늘 날짜: ${dateInfo.today}\n`);
    
    // 경제 관련 키워드들
    const economicKeywords = [
        '경제',
        '증시',
        '주식',
        '금융',
        '은행',
        '투자',
        '부동산',
        '금리',
        '환율',
        '경기',
        '기업',
        'GDP',
        '인플레이션',
        '수출',
        '무역'
    ];
    
    const allArticles = [];
    let totalCollected = 0;
    
    for (const keyword of economicKeywords) {
        if (totalCollected >= maxArticles) {
            console.log(`📊 목표 수집량(${maxArticles}개) 달성으로 수집 중단`);
            break;
        }
        
        console.log(`\n🔍 === "${keyword}" 키워드 수집 ===`);
        
        try {
            // 키워드별 최대 200개씩 수집
            const keywordArticles = await collectByKeyword(keyword, Math.min(200, maxArticles - totalCollected));
            
            if (keywordArticles.length > 0) {
                allArticles.push(...keywordArticles);
                totalCollected += keywordArticles.length;
                console.log(`✅ "${keyword}": ${keywordArticles.length}개 수집 (총 ${totalCollected}개)`);
            } else {
                console.log(`❌ "${keyword}": 수집된 기사 없음`);
            }
            
            // API 호출 간격 조절
            await new Promise(resolve => setTimeout(resolve, 1500));
            
        } catch (error) {
            console.error(`❌ "${keyword}" 수집 실패:`, error.message);
        }
    }
    
    console.log(`\n📊 전체 수집 완료: ${allArticles.length}개`);
    
    // 중복 제거
    const uniqueArticles = removeDuplicates(allArticles);
    console.log(`🔄 중복 제거: ${allArticles.length}개 → ${uniqueArticles.length}개`);
    
    // 날짜별 분석
    analyzeCollectedNews(uniqueArticles, dateInfo);
    
    // 어제 뉴스만 필터링
    const yesterdayNews = filterNewsByDate(uniqueArticles, dateInfo.yesterday);
    const todayNews = filterNewsByDate(uniqueArticles, dateInfo.today);
    
    console.log(`\n📈 날짜별 분포:`);
    console.log(`   오늘(${dateInfo.today}): ${todayNews.length}개`);
    console.log(`   어제(${dateInfo.yesterday}): ${yesterdayNews.length}개`);
    
    // 결과 저장
    await saveEconomicNews(yesterdayNews, todayNews, dateInfo);
    
    return {
        yesterday: yesterdayNews,
        today: todayNews,
        total: uniqueArticles
    };
}

// 키워드별 수집 함수
async function collectByKeyword(keyword, maxCount = 200) {
    const articles = [];
    const articlesPerPage = 100;
    let currentStart = 1;
    
    while (articles.length < maxCount && currentStart <= 1000) {
        const remainingCount = maxCount - articles.length;
        const display = Math.min(articlesPerPage, remainingCount);
        
        try {
            const result = await callNaverNewsAPI(keyword, currentStart, display, 'date');
            
            if (result.items && result.items.length > 0) {
                articles.push(...result.items);
            } else {
                break; // 더 이상 결과가 없으면 중단
            }
            
            currentStart += articlesPerPage;
            
            // API 호출 간격
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`   "${keyword}" 수집 중 오류:`, error.message);
            break;
        }
    }
    
    return articles;
}

// 수집된 뉴스 분석
function analyzeCollectedNews(articles, dateInfo) {
    console.log(`\n📊 ===== 수집 뉴스 분석 =====`);
    
    // 날짜별 통계
    const dateCount = {};
    const sourceCount = {};
    
    articles.forEach(article => {
        const pubDate = new Date(article.pubDate);
        const dateString = pubDate.toISOString().split('T')[0];
        
        // 날짜별 카운트
        dateCount[dateString] = (dateCount[dateString] || 0) + 1;
        
        // 언론사별 카운트 (간단히 도메인으로 구분)
        try {
            const url = new URL(article.originallink || article.link);
            const domain = url.hostname.replace('www.', '');
            sourceCount[domain] = (sourceCount[domain] || 0) + 1;
        } catch (e) {
            // URL 파싱 실패 시 무시
        }
    });
    
    // 날짜별 분포 출력
    console.log('📅 날짜별 분포:');
    Object.entries(dateCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([date, count]) => {
            const marker = date === dateInfo.yesterday ? '🎯' : '  ';
            console.log(`${marker} ${date}: ${count}개`);
        });
    
    // 주요 언론사 분포 출력
    console.log('\n📰 주요 언론사 분포:');
    Object.entries(sourceCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([source, count]) => {
            console.log(`   ${source}: ${count}개`);
        });
}

// 경제 뉴스 저장
async function saveEconomicNews(yesterdayNews, todayNews, dateInfo) {
    console.log(`\n💾 파일 저장 중...`);
    
    // 어제 뉴스 저장
    if (yesterdayNews.length > 0) {
        const yesterdayData = {
            category: '경제',
            date: dateInfo.yesterday,
            totalCount: yesterdayNews.length,
            collectedAt: new Date().toISOString(),
            articles: yesterdayNews.map((article, index) => ({
                id: index + 1,
                title: cleanText(article.title),
                description: cleanText(article.description),
                link: article.link,
                originallink: article.originallink,
                pubDate: article.pubDate,
                publishedKST: new Date(article.pubDate).toLocaleString('ko-KR', {
                    timeZone: 'Asia/Seoul'
                })
            }))
        };
        
        const yesterdayFilename = `economic_news_${dateInfo.yesterday.replace(/-/g, '_')}.json`;
        fs.writeFileSync(yesterdayFilename, JSON.stringify(yesterdayData, null, 2), 'utf8');
        console.log(`✅ 어제 경제뉴스 저장: ${yesterdayFilename} (${yesterdayNews.length}개)`);
    }
    
    // 오늘 뉴스 저장
    if (todayNews.length > 0) {
        const todayData = {
            category: '경제',
            date: dateInfo.today,
            totalCount: todayNews.length,
            collectedAt: new Date().toISOString(),
            articles: todayNews.map((article, index) => ({
                id: index + 1,
                title: cleanText(article.title),
                description: cleanText(article.description),
                link: article.link,
                originallink: article.originallink,
                pubDate: article.pubDate,
                publishedKST: new Date(article.pubDate).toLocaleString('ko-KR', {
                    timeZone: 'Asia/Seoul'
                })
            }))
        };
        
        const todayFilename = `economic_news_${dateInfo.today.replace(/-/g, '_')}.json`;
        fs.writeFileSync(todayFilename, JSON.stringify(todayData, null, 2), 'utf8');
        console.log(`✅ 오늘 경제뉴스 저장: ${todayFilename} (${todayNews.length}개)`);
    }
    
    // 요약 파일 저장
    const summaryData = {
        type: '경제뉴스 수집 요약',
        collectionDate: dateInfo.today,
        targetDate: dateInfo.yesterday,
        results: {
            yesterday: {
                date: dateInfo.yesterday,
                count: yesterdayNews.length
            },
            today: {
                date: dateInfo.today,
                count: todayNews.length
            }
        },
        totalCollected: yesterdayNews.length + todayNews.length,
        collectedAt: new Date().toISOString()
    };
    
    const summaryFilename = `economic_news_summary_${dateInfo.today.replace(/-/g, '_')}.json`;
    fs.writeFileSync(summaryFilename, JSON.stringify(summaryData, null, 2), 'utf8');
    console.log(`📊 요약 파일 저장: ${summaryFilename}`);
}

// 메인 실행 함수
async function main() {
    try {
        console.log('🚀 경제 뉴스 전문 수집기 시작!\n');
        
        // 최대 1500개까지 수집
        const results = await collectEconomicNews(1500);
        
        console.log(`\n🎉 경제 뉴스 수집 완료!`);
        console.log(`📊 어제 뉴스: ${results.yesterday.length}개`);
        console.log(`📊 오늘 뉴스: ${results.today.length}개`);
        console.log(`📊 전체 수집: ${results.total.length}개`);
        
        return results;
        
    } catch (error) {
        console.error('💥 수집 실패:', error);
        throw error;
    }
}

// 프로그램 실행
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✅ 모든 작업이 성공적으로 완료되었습니다!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ 프로그램 실행 실패:', error.message);
            process.exit(1);
        });
}

