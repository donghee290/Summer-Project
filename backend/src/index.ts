import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec} from './swagger/swagger';
import path from "path";
import fs from "fs";

import userRouter from "./routes/user/userRouter";
import searchRouter from "./routes/search/searchRouter";
import articleRouter from "./routes/article/articleRouter";
import mypageRouter from "./routes/mypage/mypageRouter";
import postRouter from './routes/community/postRouter';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// TODO 프론트 호출 주소 pkg에서 읽도록 수정
app.use(cors({
  origin: 'http://localhost:3000', 
  credentials: true
})); // CORS 설정
app.use(helmet()); // 보안 헤더 설정
app.use(express.json()); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL 인코딩 파싱

const imagesDir = path.resolve(process.cwd(), "model", "results", "generate_results", "images");
// 서버 부팅 시 폴더 없으면 생성
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

// /media/* URL로 이미지 서빙 (캐시 헤더 포함)
app.use(
  "/media",
  express.static(imagesDir, {
    fallthrough: false,
    maxAge: "7d",
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  })
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/user", userRouter);
app.use("/api/search", searchRouter);
app.use("/api", articleRouter);
app.use("/api/mypage", mypageRouter);
app.use('/api/posts', postRouter);

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log(`Swagger Docs: http://localhost:${PORT}/api-docs`);
});