const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

// 연합뉴스 RSS 피드 설정
const RSS_CONFIG = {
    전체: 'https://www.yonhapnewstv.co.kr/browse/feed/',
    정치: 'https://www.yonhapnewstv.co.kr/category/news/politics/feed/',
    경제: 'https://www.yonhapnewstv.co.kr/category/news/economy/feed/',
    사회: 'https://www.yonhapnewstv.co.kr/category/news/society/feed/',
    국제: 'https://www.yonhapnewstv.co.kr/category/news/international/feed/',
    스포츠: 'https://www.yonhapnewstv.co.kr/category/news/sports/feed/',
    연예: 'https://www.yonhapnewstv.co.kr/category/news/entertainment/feed/'
};

// 🔧 여기만 수정하면 쉽게 카테고리 변경 가능!
const ACTIVE_CATEGORIES = ['경제']; // 원하는 카테고리들을 배열에 추가

// RSS 피드 URL과 카테고리 이름 자동 생성
const YONHAP_RSS_FEEDS = ACTIVE_CATEGORIES.map(category => RSS_CONFIG[category]);
const categoryNames = ACTIVE_CATEGORIES;


// 어제 날짜 계산 함수
function getYesterdayDateRange() {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    
    // 어제 00:00:00
    const startOfDay = new Date(yesterday);
    startOfDay.setHours(0, 0, 0, 0);
    
    // 어제 23:59:59
    const endOfDay = new Date(yesterday);
    endOfDay.setHours(23, 59, 59, 999);
    
    const dateString = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return {
        dateString,
        startOfDay,
        endOfDay,
        displayDate: yesterday.toLocaleDateString('ko-KR')
    };
}

// HTML 태그 및 CDATA 정리 함수
function cleanText(text) {
    if (!text) return '';
    
    return text
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')  // CDATA 섹션 제거
        .replace(/<[^>]*>/g, '')                   // HTML 태그 제거
        .replace(/&quot;/g, '"')                   // HTML 엔티티 변환
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/[\r\n\t]/g, ' ')                 // 개행문자 공백으로 변환
        .replace(/\s+/g, ' ')                      // 연속 공백 하나로 변환
        .trim();
}

// RSS 피드 파싱 함수
async function parseRSSFeed(url, categoryName = 'General') {
    try {
        console.log(`📡 ${categoryName} RSS 피드를 가져오는 중... (${url})`);
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        const parser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: false,
            trim: true
        });
        
        const result = await parser.parseStringPromise(response.data);
        
        if (result.rss && result.rss.channel && result.rss.channel.item) {
            const items = Array.isArray(result.rss.channel.item) ? 
                         result.rss.channel.item : [result.rss.channel.item];
            
            console.log(`✅ ${categoryName}: ${items.length}개 뉴스 파싱 완료`);
            return items.map(item => ({
                ...item,
                category: categoryName,
                feedUrl: url
            }));
        }
        
        console.log(`⚠️  ${categoryName}: RSS 항목이 없습니다.`);
        return [];
        
    } catch (error) {
        console.error(`❌ ${categoryName} RSS 파싱 오류:`, error.message);
        return [];
    }
}

// 날짜 필터링 함수
function filterYesterdayNews(articles, dateRange) {
    console.log(`\n🔍 어제(${dateRange.displayDate}) 뉴스 필터링 시작...`);
    
    const filteredArticles = articles.filter(article => {
        // RSS의 pubDate 파싱 (RFC 2822 형식)
        let pubDate;
        
        try {
            pubDate = new Date(article.pubDate);
            
            // 날짜가 유효하지 않은 경우 건너뛰기
            if (isNaN(pubDate.getTime())) {
                console.log(`⚠️  잘못된 날짜 형식: ${article.pubDate}`);
                return false;
            }
            
            // 한국 시간대 적용 (UTC+9)
            const kstDate = new Date(pubDate.getTime() + (9 * 60 * 60 * 1000));
            
            // 어제 00:00 ~ 23:59 범위 확인
            const isYesterday = kstDate >= dateRange.startOfDay && kstDate <= dateRange.endOfDay;
            
            if (isYesterday) {
                console.log(`📰 발견: [${article.category}] ${cleanText(article.title).substring(0, 50)}...`);
                console.log(`   발행시간: ${kstDate.toLocaleString('ko-KR')}`);
            }
            
            return isYesterday;
            
        } catch (error) {
            console.log(`⚠️  날짜 파싱 오류: ${article.pubDate}`, error.message);
            return false;
        }
    });
    
    console.log(`📊 총 ${articles.length}개 중 ${filteredArticles.length}개가 어제 뉴스입니다.\n`);
    return filteredArticles;
}

// 중복 제거 함수
function removeDuplicates(articles) {
    const seen = new Set();
    const uniqueArticles = [];
    
    articles.forEach(article => {
        // 제목과 링크를 기준으로 중복 체크
        const title = cleanText(article.title);
        const link = article.link || article.guid;
        const uniqueKey = `${title}-${link}`;
        
        if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            uniqueArticles.push(article);
        }
    });
    
    console.log(`🔄 중복 제거: ${articles.length}개 → ${uniqueArticles.length}개`);
    return uniqueArticles;
}

// 뉴스 데이터 정리 함수
function processArticles(articles) {
    return articles.map((article, index) => ({
        id: index + 1,
        title: cleanText(article.title),
        description: cleanText(article.description || ''),
        link: article.link || article.guid,
        category: article.category || 'General',
        pubDate: article.pubDate,
        publishedKST: new Date(article.pubDate).toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }),
        author: cleanText(article.author || '연합뉴스'),
        feedUrl: article.feedUrl
    }));
}

// JSON 파일 저장 함수
function saveToJSON(data, filename) {
    const filepath = path.join(__dirname, filename);
    
    try {
        const jsonString = JSON.stringify(data, null, 2);
        fs.writeFileSync(filepath, jsonString, 'utf8');
        console.log(`\n💾 파일 저장 완료: ${filename}`);
        console.log(`📁 저장 경로: ${filepath}`);
        console.log(`📊 파일 크기: ${(jsonString.length / 1024).toFixed(2)} KB`);
    } catch (error) {
        console.error('❌ 파일 저장 오류:', error);
        throw error;
    }
}

// 메인 함수
async function collectYonhapYesterdayNews() {
    console.log('🚀 연합뉴스 어제 뉴스 수집을 시작합니다...\n');
    
    // 어제 날짜 정보 계산
    const dateRange = getYesterdayDateRange();
    console.log(`📅 수집 대상 날짜: ${dateRange.displayDate} (${dateRange.dateString})`);
    console.log(`⏰ 시간 범위: ${dateRange.startOfDay.toLocaleString('ko-KR')} ~ ${dateRange.endOfDay.toLocaleString('ko-KR')}\n`);
    
    const allArticles = [];
      
    try {
        // 모든 RSS 피드에서 뉴스 수집
        for (let i = 0; i < YONHAP_RSS_FEEDS.length; i++) {
            const feedUrl = YONHAP_RSS_FEEDS[i];
            const categoryName = categoryNames[i];
            
            console.log(`\n📡 === ${categoryName} 카테고리 수집 ===`);
            
            const articles = await parseRSSFeed(feedUrl, categoryName);
            
            if (articles.length > 0) {
                allArticles.push(...articles);
            }
            
            // RSS 서버 부하 방지를 위한 1초 대기
            if (i < YONHAP_RSS_FEEDS.length - 1) {
                console.log('⏳ 1초 대기...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`\n📈 =======================================`);
        console.log(`📊 전체 수집된 뉴스: ${allArticles.length}개`);
        console.log(`📈 =======================================`);
        
        if (allArticles.length === 0) {
            console.log('⚠️  수집된 뉴스가 없습니다. RSS 피드를 확인해주세요.');
            return;
        }
        
        // 어제 뉴스만 필터링
        const yesterdayArticles = filterYesterdayNews(allArticles, dateRange);
        
        if (yesterdayArticles.length === 0) {
            console.log('⚠️  어제 날짜에 해당하는 뉴스가 없습니다.');
            console.log('💡 다음을 확인해보세요:');
            console.log('   - 어제가 휴일이었는지 (뉴스 발행량이 적을 수 있음)');
            console.log('   - RSS 피드의 업데이트 주기');
            console.log('   - 시간대 설정이 올바른지');
            
            // 빈 결과도 저장
            const emptyResult = {
                collectionInfo: {
                    targetDate: dateRange.dateString,
                    displayDate: dateRange.displayDate,
                    collectionTime: new Date().toISOString(),
                    totalChecked: allArticles.length,
                    totalFound: 0,
                    note: "어제 날짜에 해당하는 뉴스를 찾지 못했습니다."
                },
                articles: []
            };
            
            saveToJSON(emptyResult, `yonhap_news_${dateRange.dateString.replace(/-/g, '_')}_empty.json`);
            return;
        }
        
        // 중복 제거
        const uniqueArticles = removeDuplicates(yesterdayArticles);
        
        // 데이터 정리 및 구조화
        const processedArticles = processArticles(uniqueArticles);
        
        // 카테고리별 통계
        const categoryStats = {};
        processedArticles.forEach(article => {
            categoryStats[article.category] = (categoryStats[article.category] || 0) + 1;
        });
        
        // 최종 결과 데이터 구성
        const finalData = {
            collectionInfo: {
                source: '연합뉴스 RSS',
                targetDate: dateRange.dateString,
                displayDate: dateRange.displayDate,
                collectionTime: new Date().toISOString(),
                totalChecked: allArticles.length,
                totalFound: processedArticles.length,
                categoryStats: categoryStats,
                rssFeeds: YONHAP_RSS_FEEDS.length
            },
            articles: processedArticles
        };
        
        // JSON 파일로 저장
        const filename = `yonhap_news_${dateRange.dateString.replace(/-/g, '_')}.json`;
        saveToJSON(finalData, filename);
        
        // 수집 결과 요약
        console.log(`\n🎉 연합뉴스 어제 뉴스 수집 완료!`);
        console.log(`📰 총 ${processedArticles.length}개의 어제 뉴스를 수집했습니다.`);
        console.log(`\n📊 카테고리별 통계:`);
        Object.entries(categoryStats).forEach(([category, count]) => {
            console.log(`   ${category}: ${count}개`);
        });
        
        return finalData;
        
    } catch (error) {
        console.error('\n💥 뉴스 수집 중 오류 발생:', error);
        throw error;
    }
}

// 프로그램 실행부
if (require.main === module) {
    collectYonhapYesterdayNews()
        .then(() => {
            console.log('\n✅ 프로그램이 성공적으로 완료되었습니다!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ 프로그램 실행 실패:', error);
            process.exit(1);
        });
}

