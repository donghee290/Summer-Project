// embedding_script.js
// Node.js에서 sBERT 임베딩을 생성하는 스크립트

import { pipeline } from '@xenova/transformers';
import fs from 'fs';

async function embedNewsArticles() {
    console.log('=== 뉴스 기사 sBERT 임베딩 시작 ===\n');
    
    // 1. 뉴스 데이터 불러오기
    console.log('1. 뉴스 데이터 파일 로드 중...');
    
    // 파일명을 실제 파일명으로 변경하세요
    const fileName = 'v3_naver_news_cleaned_1hour_2025-07-29T02-19-57-117Z.json'; // 예시
    
    let newsData;
    try {
        newsData = JSON.parse(fs.readFileSync(fileName, 'utf8'));
        console.log(`✓ ${fileName} 파일을 성공적으로 로드했습니다.`);
    } catch (error) {
        console.error('❌ 뉴스 데이터 파일을 찾을 수 없습니다.');
        console.log('현재 디렉토리의 파일들:');
        const files = fs.readdirSync('.').filter(f => f.endsWith('.json'));
        files.forEach(file => console.log(`  - ${file}`));
        
        if (files.length > 0) {
            console.log(`\n위 파일 중 하나를 선택하여 fileName 변수를 수정해주세요.`);
        }
        return;
    }

    // 2. sBERT 모델 로드
    console.log('\n2. sBERT 모델 로드 중...');
    console.log('   모델: all-MiniLM-L6-v2 (384차원 벡터 생성)');
    console.log('   처음 실행시 모델 다운로드로 시간이 걸릴 수 있습니다...');
    
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('✓ 모델 로드 완료!');

    // 3. 모든 기사에서 제목과 본문 합치기
    console.log('\n3. 기사 텍스트 전처리 중...');
    
    const allNews = [];
    const texts = [];
    
    for (const category in newsData.news) {
        for (const article of newsData.news[category]) {
            // 제목과 본문을 합쳐서 하나의 텍스트로 만들기
            const fullText = `${article.title}\n${article.content || ''}`.trim();
            
            // 너무 짧은 텍스트는 제외
            if (fullText.length > 50) {
                texts.push(fullText);
                allNews.push({
                    ...article,
                    fullText: fullText,
                    index: allNews.length
                });
            }
        }
    }
    
    console.log(`✓ 총 ${texts.length}개의 기사를 전처리했습니다.`);
    console.log(`   카테고리별 분포:`);
    
    const categoryCount = {};
    allNews.forEach(article => {
        categoryCount[article.category] = (categoryCount[article.category] || 0) + 1;
    });
    
    for (const [category, count] of Object.entries(categoryCount)) {
        console.log(`   - ${category}: ${count}개`);
    }

    // 4. 배치 단위로 임베딩 생성 (메모리 효율성을 위해)
    console.log('\n4. sBERT 임베딩 생성 중...');
    console.log('   이 과정은 기사 수에 따라 몇 분이 걸릴 수 있습니다...');
    
    const batchSize = 5; // 메모리 사용량을 고려하여 작게 설정
    const allEmbeddings = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const progress = `${i + 1}-${Math.min(i + batchSize, texts.length)}/${texts.length}`;
        
        process.stdout.write(`\r   진행률: ${progress} 기사 임베딩 중...`);

        try {
            const batchEmbeddings = await extractor(batch, { 
                pooling: 'mean',  // 평균 풀링: 모든 토큰의 평균을 계산
                normalize: true   // 정규화: 벡터 길이를 1로 만들어 코사인 유사도 계산 최적화
            });

            // 텐서를 JavaScript 배열로 변환
            const embeddingsList = batchEmbeddings.tolist();
            allEmbeddings.push(...embeddingsList);

            // 메모리 관리를 위한 작은 지연
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.error(`\n❌ 배치 ${progress} 처리 중 오류:`, error.message);
            // 오류가 발생한 배치는 건너뛰고 계속 진행
            continue;
        }
    }
    
    console.log(`\n✓ 임베딩 생성 완료! (${allEmbeddings.length}개 기사)`);

    // 5. 결과 저장
    console.log('\n5. 결과 파일 저장 중...');
    
    const result = {
        articles: allNews,
        embeddings: allEmbeddings,
        metadata: {
            model: 'Xenova/all-MiniLM-L6-v2',
            dimensions: 384,
            totalArticles: texts.length,
            createdAt: new Date().toISOString(),
            categories: categoryCount
        }
    };

    // 메인 결과 파일
    fs.writeFileSync('news_embeddings.json', JSON.stringify(result, null, 2));
    console.log('✓ news_embeddings.json 저장 완료');

    // Python clustering을 위한 CSV 파일
    const csvData = [];
    for (let i = 0; i < allNews.length; i++) {
        if (i < allEmbeddings.length) {
            csvData.push({
                index: i,
                title: allNews[i].title,
                category: allNews[i].category,
                embedding: allEmbeddings[i].join(','),
                contentLength: allNews[i].contentLength || 0
            });
        }
    }

    const csvHeader = 'index,title,category,embedding,contentLength\n';
    const csvContent = csvData.map(row => 
        `${row.index},"${row.title.replace(/"/g, '""')}",${row.category},"${row.embedding}",${row.contentLength}`
    ).join('\n');

    fs.writeFileSync('embeddings_for_clustering.csv', csvHeader + csvContent);
    console.log('✓ embeddings_for_clustering.csv 저장 완료');

    // 순수 임베딩 배열
    fs.writeFileSync('embeddings_array.json', JSON.stringify(allEmbeddings));
    console.log('✓ embeddings_array.json 저장 완료');

    console.log('\n=== 임베딩 완료! ===');
    console.log('생성된 파일들:');
    console.log('- news_embeddings.json (전체 결과)');
    console.log('- embeddings_for_clustering.csv (Python 클러스터링용)');
    console.log('- embeddings_array.json (순수 임베딩 데이터)');
    console.log('\n다음 단계: Python에서 clustering.py를 실행하세요.');

    return result;
}

// 유사한 기사 찾기 테스트 함수
async function testSimilarity() {
    console.log('\n=== 유사도 테스트 ===');
    
    try {
        const result = JSON.parse(fs.readFileSync('news_embeddings.json', 'utf8'));
        const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        
        // 테스트 쿼리
        const queries = ['경제 뉴스', '연예인 소식', '정치 이슈'];
        
        for (const query of queries) {
            console.log(`\n"${query}"와 유사한 기사 3개:`);
            
            const queryEmbedding = await extractor(query, { pooling: 'mean', normalize: true });
            const queryVector = queryEmbedding.tolist()[0];
            
            // 코사인 유사도 계산
            const similarities = result.embeddings.map((embedding, index) => {
                const dotProduct = embedding.reduce((sum, a, i) => sum + a * queryVector[i], 0);
                const magnitudeA = Math.sqrt(embedding.reduce((sum, a) => sum + a * a, 0));
                const magnitudeB = Math.sqrt(queryVector.reduce((sum, b) => sum + b * b, 0));
                const similarity = dotProduct / (magnitudeA * magnitudeB);
                
                return {
                    index,
                    similarity,
                    article: result.articles[index]
                };
            });
            
            similarities.sort((a, b) => b.similarity - a.similarity);
            
            for (let i = 0; i < 3; i++) {
                const sim = similarities[i];
                console.log(`  ${i + 1}. [${sim.similarity.toFixed(3)}] ${sim.article.title}`);
            }
        }
    } catch (error) {
        console.log('유사도 테스트를 위해서는 먼저 임베딩을 생성해주세요.');
    }
}

// 메인 실행
async function main() {
    try {
        await embedNewsArticles();
        await testSimilarity();
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        console.log('\n문제 해결 방법:');
        console.log('1. Node.js 버전 확인: node --version (v18 이상 권장)');
        console.log('2. 패키지 설치 확인: npm install @xenova/transformers');
        console.log('3. 뉴스 데이터 파일 경로 확인');
    }
}

main();
