// backend/src/routes/mypage/mypageRouter.ts

import express from 'express';
// controllers 폴더로 이동 후 mypage 폴더 안의 mypageController를 찾습니다.
import { getProfile, 
    getBookmarks, 
    getRatings, 
    getLikes,
    updateProfile,
    changePassword,
    logoutUser,
    withdrawUser } from '../../controllers/mypage/mypageController';

const mypageRouter = express.Router();

// 마이페이지 라우터 정의
mypageRouter.get('/profile', getProfile);
mypageRouter.get('/bookmarks', getBookmarks);
mypageRouter.get('/ratings', getRatings);
mypageRouter.get('/likes', getLikes);
mypageRouter.post('/profile/update', updateProfile);
mypageRouter.post('/password/change', changePassword);
mypageRouter.post('/logout', logoutUser);
mypageRouter.delete('/withdraw', withdrawUser);

export default mypageRouter;