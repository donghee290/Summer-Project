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

const MESSAGE_TOO_SHORT = '본문이 너무 짧거나 의미가 없습니다.';
const MESSAGE_AD_CONTENT = '광고성 내용이 많이 포함되어 있습니다.';
const MESSAGE_CRAWL_FAILED = '본문 크롤링 실패';
const MESSAGE_NOT_FOUND = '본문을 가져올 수 없습니다.';

const MESSAGE_SET = new Set([
  MESSAGE_TOO_SHORT,
  MESSAGE_AD_CONTENT,
  MESSAGE_CRAWL_FAILED,
  MESSAGE_NOT_FOUND
]);

// 네이버 뉴스 검색 함수
async function searchNews(keyword, display = 100) {
  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
      params: { query: keyword, display, start: 1, sort: 'date' },
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
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
  if (!content || content.length < 50) return content; // 의미 없는 본문 미리 차단
  content = content.replace(/\s+/g, ' ');

  const patterns = [
    /기자\s*[가-힣]+\s*\S*@\S+/g,
    /\[.*?기자\]/g,
    /ⓒ.*?무단.*?금지/g,
    /저작권자.*?무단.*?배포.*?금지/g,
    /\[광고\]/g, /\[AD\]/gi,
    /관련기사|더보기.*?클릭|▶.*?바로가기|>.*?클릭/g,
    /댓글.*?입력.*?|BEST댓글.*?/gi,
    /랭킹\s*뉴스|TOP이슈|실시간 뉴스|매체정보|기사제보/gi,
    /정치\s*사회\s*경제.*?윤리강령.*?출처=/gi,
    /대표전화.*?등록번호.*?무단.*?금지/gi
  ];

  for (const pattern of patterns) {
    content = content.replace(pattern, '');
  }

  content = content.replace(/^[^\w가-힣]+|[^\w가-힣.!?]+$/g, '');
  content = content.replace(/\.{3,}/g, '...');
  content = content.replace(/[!?]{2,}/g, '!');
  content = content.replace(/\s{2,}/g, ' ').trim();

  return content;
}

// 광고성 내용 검증 함수
function isAdvertisementContent(content) {
  const adKeywords = ['광고', '할인', '이벤트', '쿠폰', '혜택', '특가', '세일', '프로모션'];
  const adCount = adKeywords.reduce((count, keyword) =>
    count + (content.split(keyword).length - 1), 0);
  return content.length < 500 && adCount > 2;
}

function cleanElement($element) {
  $element.find('script, style, .ad, .advertisement, .related, .tag, .btn, button, .share, .social').remove();
  $element.find('[class*="ad"], [class*="banner"], [id*="ad"], [id*="banner"]').remove();
  $element.find('.journalist, .reporter, .copyright, .source').remove();
}

// 개선된 뉴스 본문 크롤링 함수
async function getNewsContent(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    let content = '';

    const domain = new URL(url).hostname;
    function getSelectorForDomain(hostname) {
      return Object.entries(siteSpecificSelectors).find(([domain]) =>
        hostname.includes(domain)
      )?.[1];
    }
    const specificSelector = getSelectorForDomain(domain);
    
    if (specificSelector) {
      const specificElement = $(specificSelector);
      if (specificElement.length > 0) {
        cleanElement(specificElement);
        content = specificElement.text().trim();
      }
    }
    if (!content) {
      // 네이버 뉴스
      if (url.includes('news.naver.com')) {
        const selectors = [
          '#newsct_article', '#articleBodyContents', '.se_component_wrap', '#articeBody'
        ];
        for (const selector of selectors) {
          const element = $(selector);
          if (element.length > 0) {
            cleanElement(element);
            content = element.text().trim();
            break;
          }
        }
      } else {
        const commonSelectors = [
          'article', '.article-content', '.news-content', '.article_body',
          '#article-view-content-div', '.view_txt', '.article-text'
        ];
        for (const selector of commonSelectors) {
          const element = $(selector);
          if (element.length > 0) {
            cleanElement(element);
            content = element.text().trim();
            if (content.length > 100) break;
          }
        }
      }
    }
    if (content) {
      content = cleanNewsContent(content);
      if (content.length < 200) {
        return '본문이 너무 짧거나 의미가 없습니다.';
      }
      if (isAdvertisementContent(content)) {
        return '광고성 내용이 많이 포함되어 있습니다.';
      }
      return content;
    }
    return '본문을 가져올 수 없습니다.';
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
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });
}

// HTML 태그 제거 함수
function stripHtmlTags(html) {
  const $ = cheerio.load(html || '');
  return $.text().trim();
}

// 네이버 뉴스 URL 생성 함수
function resolveCrawlUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('naver.com') && parsed.pathname.includes('/article/')) {
      return url;
    }
    const oid = url.match(/oid=(\d+)/)?.[1];
    const aid = url.match(/aid=(\d+)/)?.[1];
    if (oid && aid) {
      return `https://news.naver.com/main/read.naver?oid=${oid}&aid=${aid}`;
    }
    return url;
  } catch {
    return url;
  }
}

// 카테고리별 뉴스 수집 함수 (본문 포함)
async function collectNewsByCategory(category, keywords) {
  console.log(`\n${category} 카테고리 뉴스 수집 중...`);
  let allNews = [];
  for (const keyword of keywords) {
    console.log(` - "${keyword}" 검색 중...`);
    const newsItems = await searchNews(keyword);
    allNews = allNews.concat(newsItems);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  allNews = removeDuplicates(allNews);
  const recentNews = filterRecentNews(allNews);
  console.log(` -> ${recentNews.length}개의 최근 1시간 내 뉴스 발견`);
  console.log(` -> 본문 크롤링 시작...`);
  const newsWithContent = [];
  let successCount = 0;
  let qualityCount = 0;
  for (let i = 0; i < recentNews.length; i++) {
    const item = recentNews[i];
    const originalUrl = item.link;
    const naverUrl = resolveCrawlUrl(originalUrl);
    const urlToFetch = naverUrl || originalUrl;
    console.log(` [${i + 1}/${recentNews.length}] 본문 수집 중...`);
    const content = await getNewsContent(urlToFetch);
    let isQualityContent = false;

    // 개선: 광고·짧은 본문 자체 필터링, 의미없음/광고성 배제
    if (content && !MESSAGE_SET.has(content)) {
      successCount++;
      if (content.length > 500) {
        qualityCount++;
        isQualityContent = true;
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
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log(` -> 본문 수집 완료: ${successCount}/${recentNews.length}개 성공 (양질 콘텐츠: ${qualityCount}개)`);
  return newsWithContent;
}

// 메인 실행 함수
async function main() {
  console.log('=== 네이버 뉴스 수집기 실행 (최근 1시간 + 텍스트 정제) ===');
  console.log('최근 1시간 내 뉴스를 카테고리별로 수집하고 정제된 본문을 크롤링합니다.\n');
  const collectedNews = { economy: [], society: [], entertainment: [] };
  try {
    for (const [category, keywords] of Object.entries(KEYWORDS)) {
      collectedNews[category] = await collectNewsByCategory(category, keywords);
    }
    const totalCount = Object.values(collectedNews).reduce((sum, news) => sum + news.length, 0);
    const contentSuccessCount = Object.values(collectedNews).reduce(
      (sum, news) =>
        sum +
        news.filter(
          item => item.content && !MESSAGE_SET.has(item.content)
        ).length,
      0
    );
    const qualityContentCount = Object.values(collectedNews).reduce(
      (sum, news) => sum + news.filter(item => item.isQualityContent).length, 0
    );
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
    const outputDir = './sample_results';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    const filename = `${outputDir}/v3_naver_news_cleaned_1hour_${timestamp}.json`;
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

