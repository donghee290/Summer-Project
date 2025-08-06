import axios from 'axios';

async function testSearchAPI() {
  try {
    const res = await axios.get('http://localhost:8080/api/search', {
      params: {
        keyword: '경제',
        category: '1',
        searchRange: 'title_content',
        sort: 'latest',
        startDate: '2025-01-01',
        endDate: '2025-08-06',
        page: 1,
        size: 5
      }
    });

    console.log('✅ 검색 API 응답:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    if (err.response) {
      console.error('❌ API 에러 응답:', err.response.data);
    } else {
      console.error('❌ 요청 실패:', err.message);
    }
  }
}

testSearchAPI();