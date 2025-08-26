"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
async function testSearchAPI() {
    try {
        const res = await axios_1.default.get('http://localhost:8080/api/search', {
            params: {
                keyword: 'AI',
                category: '트렌드',
                searchRange: 'title_content',
                sort: 'latest',
                startDate: '2025-01-01',
                endDate: '2025-08-07',
                page: 1,
                size: 5
            }
        });
        console.log('검색 API 응답:', JSON.stringify(res.data, null, 2));
    }
    catch (err) {
        if (err.response) {
            console.error('API 에러 응답:', err.response.data);
        }
        else {
            console.error('요청 실패:', err.message);
        }
    }
}
testSearchAPI();
