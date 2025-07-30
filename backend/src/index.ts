import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";

import userRouter from "./routes/user/userRouter";

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


app.use("/api/user", userRouter);


app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
