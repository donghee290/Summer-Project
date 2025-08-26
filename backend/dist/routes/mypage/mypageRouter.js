"use strict";
// backend/src/routes/mypage/mypageRouter.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
// controllers 폴더로 이동 후 mypage 폴더 안의 mypageController를 찾습니다.
const mypageController_1 = require("../../controllers/mypage/mypageController");
const mypageRouter = express_1.default.Router();
// 마이페이지 라우터 정의
mypageRouter.get('/profile', mypageController_1.getProfile);
mypageRouter.get('/bookmarks', mypageController_1.getBookmarks);
mypageRouter.get('/ratings', mypageController_1.getRatings);
mypageRouter.get('/likes', mypageController_1.getLikes);
mypageRouter.post('/profile/update', mypageController_1.updateProfile);
mypageRouter.post('/password/change', mypageController_1.changePassword);
mypageRouter.post('/logout', mypageController_1.logoutUser);
mypageRouter.delete('/withdraw', mypageController_1.withdrawUser);
exports.default = mypageRouter;
