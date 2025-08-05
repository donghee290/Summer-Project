// embedding_kosimcse.js
import { pipeline, env } from '@xenova/transformers';
import fs from 'fs';

// Hugging Face 설정
env.allowLocalModels = false;
env.allowRemoteModels = true;

class KoSimCSEEmbedder {
    constructor() {
        this.extractor = null;
        this.modelName = 'BM-K/KoSimCSE-roberta-multitask';
        this.dimensions = 768;
    }

    async initialize() {
        console.log('🚀 KoSimCSE-RoBERTa 모델 로딩 시도...');
        console.log(`   모델: ${this.modelName}`);
        
        try {
            // KoSimCSE 모델 직접 로딩 시도
            this.extractor = await pipeline(
                'feature-extraction',
                this.modelName,
                {
                    revision: 'main',
                    cache_dir: './kosimcse_cache',
                    dtype: 'fp32',
                    device: 'auto'
                }
            );
            
            console.log('✅ KoSimCSE-RoBERTa 모델 로드 성공!');
            console.log(`   차원: ${this.dimensions}`);
            return true;
            
        } catch (error) {
            console.error('❌ KoSimCSE 모델 로딩 실패:', error.message);
            
            // 대안 1: 다른 리비전 시도
            try {
                console.log('   다른 리비전으로 재시도...');
                this.extractor = await pipeline(
                    'feature-extraction',
                    this.modelName,
                    {
                        revision: 'refs/pr/1',  // 다른 브랜치
                        cache_dir: './kosimcse_cache'
                    }
                );
                console.log('✅ 대안 리비전으로 로드 성공!');
                return true;
                
            } catch (revisionError) {
                console.log('   리비전 시도도 실패, 유사 모델 탐색...');
                
                // 대안 2: 비슷한 한국어 SimCSE 모델들
                const alternativeModels = [
                    'princeton-nlp/sup-simcse-roberta-large',
                    'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
                    'jhgan/ko-sroberta-multitask'
                ];
                
                for (const altModel of alternativeModels) {
                    try {
                        console.log(`   대안 모델 시도: ${altModel}`);
                        this.extractor = await pipeline('feature-extraction', altModel);
                        this.modelName = altModel;
                        console.log(`✅ 대안 모델 로드 성공: ${altModel}`);
                        return true;
                    } catch (altError) {
                        continue;
                    }
                }
                
                throw new Error('모든 모델 로딩 실패');
            }
        }
    }

    // KoSimCSE 전용 전처리
    preprocessForKoSimCSE(text) {
        if (!text) return '';
        
        // KoSimCSE는 문장 단위 처리를 선호
        let cleaned = text
            .replace(/\s+/g, ' ')
            .replace(/[""'']/g, '"')
            .replace(/…/g, '...')
            .trim();
        
        // URL, 이메일 제거
        cleaned = cleaned
            .replace(/https?:\/\/[^\s]+/g, '')
            .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
        
        // 뉴스 특화 상용구 제거
        const newsBoilerplates = [
            /\[.*?기자\]/g,
            /\(.*?뉴스\)/g,
            /무단.*?금지/g,
            /저작권.*?뉴스/g
        ];
        
        for (const pattern of newsBoilerplates) {
            cleaned = cleaned.replace(pattern, '');
        }
        
        // 문장 분리 및 정리
        const sentences = cleaned.split(/[.!?]/)
            .map(s => s.trim())
            .filter(s => s.length > 15 && s.length < 500)  // KoSimCSE 최적 길이
            .slice(0, 3);  // 처음 3문장만
        
        return sentences.join('. ');
    }

    // SimCSE 스타일 임베딩 생성
    async generateSimCSEEmbedding(text) {
        const processedText = this.preprocessForKoSimCSE(text);
        
        if (processedText.length < 10) {
            console.warn('텍스트가 너무 짧습니다:', text.slice(0, 50));
            return new Array(this.dimensions).fill(0);
        }
        
        try {
            // SimCSE는 CLS 토큰 사용 (mean pooling 대신)
            const embedding = await this.extractor(processedText, {
                pooling: 'cls',  // SimCSE 특화
                normalize: true
            });
            
            return embedding.tolist()[0];
            
        } catch (error) {
            console.error('임베딩 생성 실패:', error.message);
            return new Array(this.dimensions).fill(0);
        }
    }

    async embedNewsArticles() {
        console.log('=== KoSimCSE 한국어 뉴스 임베딩 시작 ===\n');
        
        // 1. 모델 초기화
        const initSuccess = await this.initialize();
        if (!initSuccess) {
            console.error('모델 초기화 실패');
            return;
        }
        
        // 2. 데이터 로드
        console.log('1. 뉴스 데이터 로드 중...');
        const fileName = 'source/v3_naver_news_cleaned_1hour_2025-07-29T02-19-57-117Z.json';
        
        let newsData;
        try {
            newsData = JSON.parse(fs.readFileSync(fileName, 'utf8'));
            console.log(`✅ ${fileName} 로드 완료`);
        } catch (error) {
            console.error('❌ 파일 로드 실패:', error.message);
            return;
        }
        
        // 3. 데이터 전처리
        console.log('\n2. KoSimCSE 최적화 전처리 중...');
        const allNews = [];
        const categoryStats = {};
        
        for (const category in newsData.news) {
            if (!Array.isArray(newsData.news[category])) continue;
            
            for (const article of newsData.news[category]) {
                const titleCleaned = this.preprocessForKoSimCSE(article.title);
                const contentCleaned = this.preprocessForKoSimCSE(article.content || '');
                
                // 제목 + 내용 결합 (SimCSE는 문장 단위 선호)
                const fullText = `${titleCleaned}. ${contentCleaned}`.trim();
                
                if (fullText.length > 20 && titleCleaned.length > 5) {
                    allNews.push({
                        ...article,
                        titleCleaned,
                        contentCleaned,
                        fullText,
                        textLength: fullText.length,
                        index: allNews.length
                    });
                    
                    categoryStats[category] = (categoryStats[category] || 0) + 1;
                }
            }
        }
        
        console.log(`✅ 전처리 완료: ${allNews.length}개 기사`);
        console.log('카테고리별 분포:');
        for (const [cat, count] of Object.entries(categoryStats)) {
            console.log(`   ${cat}: ${count}개`);
        }
        
        // 4. SimCSE 임베딩 생성
        console.log('\n3. KoSimCSE 임베딩 생성 중...');
        const batchSize = 2;  // SimCSE는 더 무거우므로 작게
        const allEmbeddings = [];
        const failedCount = 0;
        
        for (let i = 0; i < allNews.length; i += batchSize) {
            const batchEnd = Math.min(i + batchSize, allNews.length);
            const progress = `${i + 1}-${batchEnd}/${allNews.length}`;
            
            process.stdout.write(`\r   진행률: ${progress} (실패: ${failedCount})`);
            
            try {
                // 배치 처리
                const batchPromises = [];
                for (let j = i; j < batchEnd; j++) {
                    batchPromises.push(
                        this.generateSimCSEEmbedding(allNews[j].fullText)
                    );
                }
                
                const batchEmbeddings = await Promise.all(batchPromises);
                allEmbeddings.push(...batchEmbeddings);
                
                // GPU 메모리 관리
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`\n❌ 배치 ${progress} 실패:`, error.message);
                // 실패한 배치는 제로 벡터로 대체
                for (let j = i; j < batchEnd; j++) {
                    allEmbeddings.push(new Array(this.dimensions).fill(0));
                }
            }
        }
        
        console.log(`\n✅ KoSimCSE 임베딩 완료!`);
        
        // 5. 결과 저장
        console.log('\n4. 결과 저장 중...');
        
        const result = {
            articles: allNews,
            embeddings: allEmbeddings,
            meta : {
                model: this.modelName,
                embedding_method: 'KoSimCSE',
                dimensions: this.dimensions,
                totalArticles: allNews.length,
                successRate: (allNews.length - failedCount) / allNews.length,
                createdAt: new Date().toISOString(),
                categories: categoryStats,
                preprocessing: 'kosimcse_optimized',
                version: '3.0'
            }
        };
        
        // JSON 저장
        fs.writeFileSync('kosimcse_news_embeddings.json', JSON.stringify(result, null, 2));
        console.log('✅ kosimcse_news_embeddings.json 저장');
        
        // CSV 저장 (클러스터링용)
        const csvData = allNews.map((article, i) => ({
            index: i,
            title: article.titleCleaned.replace(/"/g, '""'),
            category: article.category,
            textLength: article.textLength,
            embedding: allEmbeddings[i].join(','),
            pubDate: article.pubDate || '',
            url: article.originalUrl || ''
        })).filter(row => !row.embedding.includes('0,0,0'));  // 제로 벡터 제외
        
        const csvHeader = 'index,title,category,textLength,embedding,pubDate,url\n';
        const csvContent = csvData.map(row => 
            `${row.index},"${row.title}",${row.category},${row.textLength},"${row.embedding}","${row.pubDate}","${row.url}"`
        ).join('\n');
        
        fs.writeFileSync('kosimcse_embeddings_for_clustering.csv', csvHeader + csvContent);
        console.log('✅ kosimcse_embeddings_for_clustering.csv 저장');
        
        console.log('\n=== KoSimCSE 임베딩 완료! ===');
        console.log(`사용 모델: ${this.modelName}`);
        console.log(`임베딩 차원: ${this.dimensions}`);
        console.log(`처리 기사: ${csvData.length}개`);
        
        return result;
    }
    
    // SimCSE 특화 유사도 테스트
    async testKoSimCSESimilarity() {
        console.log('\n=== KoSimCSE 유사도 테스트 ===');
        
        try {
            const result = JSON.parse(fs.readFileSync('kosimcse_news_embeddings.json', 'utf8'));
            
            const queries = [
                '경제 성장과 투자 유치',
                '지역 발전과 일자리 창출',
                '기술 혁신과 스타트업',
                '농업 발전과 수출 확대'
            ];
            
            for (const query of queries) {
                console.log(`\n"${query}" 유사 기사 Top 3:`);
                
                const queryEmbedding = await this.generateSimCSEEmbedding(query);
                
                // 코사인 유사도 계산 (SimCSE 표준)
                const similarities = result.embeddings.map((embedding, index) => {
                    if (embedding.every(val => val === 0)) return null;
                    
                    const dotProduct = embedding.reduce((sum, a, i) => sum + a * queryEmbedding[i], 0);
                    const magA = Math.sqrt(embedding.reduce((sum, a) => sum + a * a, 0));
                    const magB = Math.sqrt(queryEmbedding.reduce((sum, b) => sum + b * b, 0));
                    
                    return {
                        index,
                        similarity: dotProduct / (magA * magB),
                        article: result.articles[index]
                    };
                }).filter(Boolean);
                
                similarities.sort((a, b) => b.similarity - a.similarity);
                
                for (let i = 0; i < 3; i++) {
                    const sim = similarities[i];
                    if (sim) {
                        console.log(`  ${i + 1}. [${sim.similarity.toFixed(4)}] ${sim.article.titleCleaned}`);
                        console.log(`     카테고리: ${sim.article.category}`);
                    }
                }
            }
            
        } catch (error) {
            console.error('유사도 테스트 실패:', error.message);
        }
    }
}

// 메인 실행
async function main() {
    const embedder = new KoSimCSEEmbedder();
    
    try {
        await embedder.embedNewsArticles();
        await embedder.testKoSimCSESimilarity();
        
        console.log('\n🎯 다음 단계:');
        console.log('python kosimcse_clustering.py  # Python 클러스터링');
        
    } catch (error) {
        console.error('❌ 실행 실패:', error.message);
        console.log('\n해결책:');
        console.log('1. npm install @xenova/transformers@latest');
        console.log('2. 인터넷 연결 확인 (모델 다운로드 4-5분 소요)');
        console.log('3. Node.js 메모리 증설: node --max-old-space-size=8192 embedding_kosimcse.js');
    }
}

main();

