require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class NaverNewsClassifier {
    constructor(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.baseUrl = 'https://openapi.naver.com/v1/search/news.json';
    }
    
    // HTML 태그 제거 함수
    cleanText(text) {
        if (!text) return '';
        return text
            .replace(/<[^>]*>/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }
    
    async searchByKeyword(keyword, maxResults = 50) {
        try {
            console.log(`   🔍 "${keyword}" 검색 중...`);
            
            const response = await axios.get(this.baseUrl, {
                params: {
                    query: keyword,
                    display: maxResults,
                    sort: 'date'
                },
                headers: {
                    'X-Naver-Client-Id': this.clientId,
                    'X-Naver-Client-Secret': this.clientSecret
                }
            });
            
            console.log(`   ✅ "${keyword}": ${response.data.items.length}개 기사 수집`);
            return response.data.items;
            
        } catch (error) {
            console.error(`   ❌ "${keyword}" 검색 실패:`, error.message);
            return [];
        }
    }
    
    async collectCategorizedNews() {
        console.log('🚀 네이버 뉴스 카테고리별 수집을 시작합니다...\n');
        
        const categories = {
            '정치': ['정치', '국회', '대통령'],
            '경제': ['경제', '증시', '주식'],
            '사회': ['사회', '사건', '교육'],
            '국제': ['국제', '미국', '외교'],
            '스포츠': ['스포츠', '야구', '축구'],
            '연예': ['연예', '가수', '드라마']
        };
        
        const results = {};
        
        for (const [category, keywords] of Object.entries(categories)) {
            console.log(`📡 ${category} 카테고리 수집 중...`);
            
            const categoryArticles = [];
            
            for (const keyword of keywords) {
                const articles = await this.searchByKeyword(keyword, 50);
                
                const classifiedArticles = articles.map(article => ({
                    ...article,
                    title: this.cleanText(article.title),
                    description: this.cleanText(article.description),
                    primaryCategory: category,
                    searchKeyword: keyword,
                    autoCategory: this.classifyByContent(article),
                    confidence: this.calculateConfidence(article, category),
                    publishedKST: new Date(article.pubDate).toLocaleString('ko-KR')
                }));
                
                categoryArticles.push(...classifiedArticles);
                
                // API 호출 제한 고려 (1초 대기)
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // 중복 제거 및 신뢰도 기반 필터링
            const uniqueArticles = this.removeDuplicates(categoryArticles);
            const filteredArticles = this.filterByConfidence(uniqueArticles, 0.2);
            
            results[category] = filteredArticles;
            console.log(`✅ ${category}: ${filteredArticles.length}개 기사 분류 완료\n`);
        }
        
        return results;
    }
    
    classifyByContent(article) {
        const content = `${article.title} ${article.description}`.toLowerCase();
        
        const patterns = {
            '정치': /정치|국회|대통령|정부|장관|의원|선거|정당|국정|정책/g,
            '경제': /경제|주식|증시|금융|기업|투자|부동산|금리|환율|GDP/g,
            '사회': /사회|사건|사고|교육|의료|복지|환경|범죄|재판|판결/g,
            '국제': /국제|미국|중국|일본|외교|무역|해외|글로벌|세계/g,
            '스포츠': /스포츠|야구|축구|농구|올림픽|경기|선수|리그|월드컵/g,
            '연예': /연예|가수|배우|드라마|영화|아이돌|콘서트|앨범/g
        };
        
        let maxMatches = 0;
        let bestCategory = '기타';
        
        for (const [category, pattern] of Object.entries(patterns)) {
            const matches = (content.match(pattern) || []).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                bestCategory = category;
            }
        }
        
        return bestCategory;
    }
    
    calculateConfidence(article, targetCategory) {
        const content = `${article.title} ${article.description}`.toLowerCase();
        const categoryWords = this.getCategoryWords(targetCategory);
        
        let matchCount = 0;
        categoryWords.forEach(word => {
            if (content.includes(word)) matchCount++;
        });
        
        return Math.min(matchCount / categoryWords.length, 1.0);
    }
    
    getCategoryWords(category) {
        const wordMap = {
            '정치': ['정치', '국회', '대통령', '정부', '장관', '의원'],
            '경제': ['경제', '주식', '증시', '금융', '기업', '투자'],
            '사회': ['사회', '사건', '사고', '교육', '의료', '복지'],
            '국제': ['국제', '미국', '중국', '외교', '무역', '해외'],
            '스포츠': ['스포츠', '야구', '축구', '경기', '선수', '리그'],
            '연예': ['연예', '가수', '배우', '드라마', '영화', '아이돌']
        };
        
        return wordMap[category] || [];
    }
    
    removeDuplicates(articles) {
        const seen = new Set();
        return articles.filter(article => {
            const key = `${article.title}-${article.link}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
    
    filterByConfidence(articles, minConfidence = 0.3) {
        return articles.filter(article => article.confidence >= minConfidence);
    }
    
    // 결과를 JSON 파일로 저장
    saveResults(categorizedNews) {
        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '_');
        const filename = `categorized_news_${timestamp}.json`;
        
        const saveData = {
            collectionInfo: {
                collectedAt: new Date().toISOString(),
                totalCategories: Object.keys(categorizedNews).length,
                totalArticles: Object.values(categorizedNews).reduce((sum, articles) => sum + articles.length, 0)
            },
            categories: {}
        };
        
        // 카테고리별 데이터 정리
        for (const [category, articles] of Object.entries(categorizedNews)) {
            saveData.categories[category] = {
                count: articles.length,
                articles: articles.map((article, index) => ({
                    id: index + 1,
                    title: article.title,
                    description: article.description,
                    link: article.link,
                    originallink: article.originallink,
                    pubDate: article.pubDate,
                    publishedKST: article.publishedKST,
                    primaryCategory: article.primaryCategory,
                    autoCategory: article.autoCategory,
                    confidence: parseFloat(article.confidence.toFixed(3)),
                    searchKeyword: article.searchKeyword
                }))
            };
        }
        
        try {
            fs.writeFileSync(filename, JSON.stringify(saveData, null, 2), 'utf8');
            console.log(`💾 결과 저장 완료: ${filename}`);
            console.log(`📊 파일 크기: ${(JSON.stringify(saveData).length / 1024).toFixed(2)} KB`);
        } catch (error) {
            console.error('❌ 파일 저장 실패:', error.message);
        }
    }
}

// 메인 실행 함수
async function main() {
    try {
        // 네이버 API 키 설정
        const classifier = new NaverNewsClassifier(
            process.env.NAVER_CLIENT_ID,
            process.env.NAVER_CLIENT_SECRET
        );
        
        // 카테고리별 뉴스 수집
        const categorizedNews = await classifier.collectCategorizedNews();
        
        // 결과 출력
        console.log('🎉 수집 완료! 카테고리별 결과:\n');
        
        let totalArticles = 0;
        for (const [category, articles] of Object.entries(categorizedNews)) {
            totalArticles += articles.length;
            console.log(`📰 ${category}: ${articles.length}개`);
            
            // 각 카테고리별 상위 3개 기사 미리보기
            articles.slice(0, 3).forEach((article, index) => {
                console.log(`  ${index + 1}. ${article.title}`);
                console.log(`     신뢰도: ${article.confidence.toFixed(2)} | 자동분류: ${article.autoCategory} | 키워드: ${article.searchKeyword}`);
            });
            
            if (articles.length > 3) {
                console.log(`     ... 외 ${articles.length - 3}개 더`);
            }
            console.log('');
        }
        
        console.log(`📊 총 수집 기사: ${totalArticles}개`);
        
        // JSON 파일로 저장
        classifier.saveResults(categorizedNews);
        
        // 카테고리별 통계
        console.log('\n📈 카테고리별 통계:');
        const categoryStats = Object.entries(categorizedNews)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([category, articles]) => ({
                category,
                count: articles.length,
                avgConfidence: (articles.reduce((sum, article) => sum + article.confidence, 0) / articles.length).toFixed(3)
            }));
            
        categoryStats.forEach(stat => {
            console.log(`   ${stat.category}: ${stat.count}개 (평균 신뢰도: ${stat.avgConfidence})`);
        });
        
        return categorizedNews;
        
    } catch (error) {
        console.error('💥 프로그램 실행 중 오류 발생:', error.message);
        process.exit(1);
    }
}

// 프로그램 시작점
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✅ 모든 작업이 완료되었습니다!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 프로그램 실행 실패:', error.message);
            process.exit(1);
        });
}

module.exports = NaverNewsClassifier;

