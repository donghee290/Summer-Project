"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./swagger/swagger");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const userRouter_1 = __importDefault(require("./routes/user/userRouter"));
const searchRouter_1 = __importDefault(require("./routes/search/searchRouter"));
const articleRouter_1 = __importDefault(require("./routes/article/articleRouter"));
const mypageRouter_1 = __importDefault(require("./routes/mypage/mypageRouter"));
const postRouter_1 = __importDefault(require("./routes/community/postRouter"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
// TODO 프론트 호출 주소 pkg에서 읽도록 수정
app.use((0, cors_1.default)({
    origin: 'http://localhost:3000',
    credentials: true
})); // CORS 설정
app.use((0, helmet_1.default)()); // 보안 헤더 설정
app.use(express_1.default.json()); // JSON 파싱
app.use(express_1.default.urlencoded({ extended: true })); // URL 인코딩 파싱
const imagesDir = path_1.default.resolve(process.cwd(), "model", "results", "generate_results", "images");
// 서버 부팅 시 폴더 없으면 생성
if (!fs_1.default.existsSync(imagesDir))
    fs_1.default.mkdirSync(imagesDir, { recursive: true });
// /media/* URL로 이미지 서빙 (캐시 헤더 포함)
app.use("/media", express_1.default.static(imagesDir, {
    fallthrough: false,
    maxAge: "7d",
    setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
}));
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
app.use("/api/user", userRouter_1.default);
app.use("/api/search", searchRouter_1.default);
app.use("/api", articleRouter_1.default);
app.use("/api/mypage", mypageRouter_1.default);
app.use('/api/posts', postRouter_1.default);
app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
    console.log(`Swagger Docs: http://localhost:${PORT}/api-docs`);
});
