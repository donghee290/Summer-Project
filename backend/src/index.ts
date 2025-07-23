import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";

import userRouter from "./routes/user/userRouter";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors()); // CORS 설정
app.use(helmet()); // 보안 헤더 설정
app.use(express.json()); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL 인코딩 파싱


app.use("/user", userRouter);


app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
