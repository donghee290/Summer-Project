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
      params: { query: keyword, display, start: 1, sort: 'date' },
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

// ---- [강화판] 본문 텍스트 정제 함수 ----
function cleanNewsContent(content) {
  if (!content || content.length < 10) return content;
  content = content.replace(/\s+/g, ' ');

  const unnecessaryPatterns = [
    // --- 기존 기본 필터 ---//
@,
    /function _flash_removeCallback[\s\S]*?}/g,
    /\/\/ flash 오류를 우회하기 위한 함수 추가[\s\S]*?\/\/ flash 오류를 우회하기 위한 함수 추가/g,
    /기자\s*[가-힣]+@[a-zA-Z0-9_.-]+\.[a-zA-Z], 연합뉴스.*?기자/g,
    /\[.*?기자\]/g, \s*기자/g,
    /ⓒ.*?무단.*?금지/g, 저작권자.*?무단.*?배포.*?금지/g,
    /Copyright.*?All rights reserved/gi,
    /무단전재.*?재배포.*?금지/g, \[광고\]/g, \[AD\]/gi,
    /제공[:：]\s*[가-힣A-Za-z0-]+g, 협찬.*?제공/g,
    /관련기사/g, ▶.*?바로가기/g, >.*?클릭/g, /더보기.*?클릭g,
    /페이스북\s*트위터\s*카카오스토리/g, /공유하기\s*스크랩g,
    /좋아요\s*공유\s*댓글/g, /네이버에서도 확인해보세요g,
    /이 기사를.*?추천합니다/g, /동영상 뉴스g, /포토 뉴스g,
    /실시간 뉴스/g, /구독.*?알림g, /팔로우.*?알림g,
    /뉴스레터.*?구독/g, \[사진=.*?\]g, \[영상=.*?\]/g,
    /편집자주.*?$/gm, ※.*?$/gm,
    // --- 추가: 로그인/댓글 UI 안내문구 ---
    /댓글\s*내용입력\s*\d+\s*\/\s*\d+/g,
    /댓글\s*정렬\s*BEST댓글.*?자동노출된다\./g,
    /댓글\s*정렬\s*BEST 댓글.*?자동으로 노출된다\./g,
    /비밀번호\s*본문\s*\/\s*\d+\s*비밀번호/g,
    /비밀번호\s*댓글\s*.*?자동등록방지/g,
    /회원\s*로그인/g, 
    /(이메일)?무단전재.*?(허가|금지)/gi,
    /BEST댓글.*?댓글 답글과 추천수를 합산.*?자동으로 노출됩니다\./gi,
    /내 댓글 모음.*?종합 더보기/gi,
    /랭킹\s*뉴스/gi, TOP이슈/gi, 매체정보/gi, 키워드.*?(댓글|기사)/gi,
    /기사제보/gi, 이( 기사가| 기사인| 뉴스| 기사를)? 후원해 주세요,
    /comments?\s*내용입력.*?BEST댓글/gi,
    /로그인(하면|하셔야|해서)? .*?(작성|댓글|공유|후원|삭제|블락)/gi,
    /(반론[권]?|반론신청|정정신청)/gi,
    /이슈.*?이슈.*?이슈.*?이슈.*?이슈.*?pause/gi, // TOP이슈 등 반복
    /정치\s*사회\s*경제\s*국제\s*스포츠.*?인터넷신문위원회.*?윤리강령.*?가요\s*방송\s*영화.*?출처=/gi,
    /다른기사\s*보기?/gi,
    // 상호중복 블럭 및 만연한 안내
    /\b(BEST댓글|댓글 내용입력|본문 \/ \d+|회원 로그인|자동등록방지|매체정보|랭킹 뉴스|내 댓글 모음|기사제보|키워드|TOP이슈|댓글 정렬|정치 사회 경제 국제 스포츠 로그인|동영상 뉴스|포토 뉴스|실시간 뉴스)\b/gi,
    // 하단 주의
    /^.{0,20}대표전화.*?제호.*?등록번호.*?발행.*?청소년보호책임자.*?무단.*?금지.*제공.*?기호일보.*?company.*?서비스/gi,
  ];
  for (const pattern of unnecessaryPatterns) {
    content = content.replace(pattern, '');
  }
  // 문장 시작/끝, 연속 마침표/특수문자 등
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
  return adCount > 3;
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
    const specificSelector = siteSpecificSelectors[domain];
    if (specificSelector) {
      const specificElement = $(specificSelector);
      if (specificElement.length > 0) {
        specificElement.find('script, style, .ad, .advertisement, .related, .tag, .btn, button, .share, .social').remove();
        specificElement.find('[class*="ad"], [class*="banner"], [id*="ad"], [id*="banner"]').remove();
        specificElement.find('.journalist, .reporter, .copyright, .source').remove();
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
            element.find('script, style, .ad, .advertisement, .related, .tag, .btn, button, .share, .social').remove();
            element.find('[class*="ad"], [class*="banner"], [id*="ad"], [id*="banner"]').remove();
            element.find('.journalist, .reporter, .copyright, .source').remove();
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
            element.find('script, style, .ad, .advertisement, .related, .tag, .btn, button, .share, .social').remove();
            element.find('[class*="ad"], [class*="banner"], [id*="ad"], [id*="banner"]').remove();
            element.find('.journalist, .reporter, .copyright, .source').remove();
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
function stripHtmlTags(text) {
  return text.replace(/<[^>]*>/g, '').replace(/"/g, '"').replace(/</g, '<').replace(/>/g, '>').replace(/&/g, '&');
}

// 네이버 뉴스 URL 생성 함수
function generateNaverNewsUrl(originalUrl) {
  if (originalUrl.includes('news.naver.com')) return originalUrl;
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
    const naverUrl = generateNaverNewsUrl(originalUrl);
    const urlToFetch = naverUrl || originalUrl;
    console.log(` [${i + 1}/${recentNews.length}] 본문 수집 중...`);
    const content = await getNewsContent(urlToFetch);
    let isQualityContent = false;
    // --- 개선: 광고·짧은 본문 자체 필터링, 의미없음/광고성 배제 ---
    if (
      content &&
      content !== '본문을 가져올 수 없습니다.' &&
      content !== '본문 크롤링 실패' &&
      content !== '본문이 너무 짧거나 의미가 없습니다.' &&
      content !== '광고성 내용이 많이 포함되어 있습니다.'
    ) {
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
          item =>
            item.content &&
            item.content !== '본문을 가져올 수 없습니다.' &&
            item.content !== '본문 크롤링 실패' &&
            item.content !== '본문이 너무 짧거나 의미가 없습니다.' &&
            item.content !== '광고성 내용이 많이 포함되어 있습니다.'
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

