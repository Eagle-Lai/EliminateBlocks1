/**
 * 关卡表（自动生成，勿手改）：6 章 × 20 关 = 120 关。
 * 生成器：scripts/gen-content/levels.ts；校验：npm run verify:content
 */
export interface LevelEntry {
    id: number;
    chapter: number;
    slot: number;
    name: string;
    mutationId: number;
    tier: 'light' | 'standard' | 'strong';
    goalType: 'score' | 'rows' | 'color' | 'special' | 'burst' | 'stone';
    target: number;
    goalColor?: number;
    star2: number;
    star3: number;
    seed: number;
    stoneSeed?: number;
    stoneCount?: number;
}

export const LEVELS: readonly LevelEntry[] = [
    { id: 1, chapter: 1, slot: 1, name: '初雪庭院', mutationId: 1, tier: 'light', goalType: 'score', target: 1200, star2: 1575, star3: 1650, seed: 7919 },
    { id: 2, chapter: 1, slot: 2, name: '糖霜庭院', mutationId: 7, tier: 'light', goalType: 'rows', target: 6, star2: 4823, star3: 8048, seed: 15838 },
    { id: 3, chapter: 1, slot: 3, name: '薄荷庭院', mutationId: 1, tier: 'light', goalType: 'color', target: 8, goalColor: 1, star2: 6710, star3: 8830, seed: 23757 },
    { id: 4, chapter: 1, slot: 4, name: '蜜橘庭院', mutationId: 7, tier: 'light', goalType: 'special', target: 2, star2: 1080, star3: 1081, seed: 31676 },
    { id: 5, chapter: 1, slot: 5, name: '青柠庭院', mutationId: 1, tier: 'light', goalType: 'burst', target: 1, star2: 2578, star3: 2778, seed: 39595 },
    { id: 6, chapter: 1, slot: 6, name: '汽水庭院', mutationId: 7, tier: 'light', goalType: 'stone', target: 8, star2: 200, star3: 201, seed: 47514, stoneSeed: 628374, stoneCount: 10 },
    { id: 7, chapter: 1, slot: 7, name: '葡萄庭院', mutationId: 1, tier: 'light', goalType: 'score', target: 1650, star2: 1755, star3: 1950, seed: 55433 },
    { id: 8, chapter: 1, slot: 8, name: '星屑庭院', mutationId: 7, tier: 'light', goalType: 'rows', target: 8, star2: 9140, star3: 10635, seed: 63352 },
    { id: 9, chapter: 1, slot: 9, name: '月牙庭院', mutationId: 1, tier: 'standard', goalType: 'color', target: 9, goalColor: 2, star2: 4420, star3: 5825, seed: 71271 },
    { id: 10, chapter: 1, slot: 10, name: '云朵庭院', mutationId: 7, tier: 'standard', goalType: 'special', target: 3, star2: 1103, star3: 1700, seed: 79190 },
    { id: 11, chapter: 1, slot: 11, name: '风铃庭院', mutationId: 1, tier: 'standard', goalType: 'burst', target: 1, star2: 2440, star3: 2600, seed: 87109 },
    { id: 12, chapter: 1, slot: 12, name: '暖阳庭院', mutationId: 7, tier: 'standard', goalType: 'stone', target: 8, star2: 740, star3: 1640, seed: 95028, stoneSeed: 1256748, stoneCount: 10 },
    { id: 13, chapter: 1, slot: 13, name: '微光庭院', mutationId: 1, tier: 'standard', goalType: 'score', target: 2250, star2: 2448, star3: 2785, seed: 102947 },
    { id: 14, chapter: 1, slot: 14, name: '涟漪庭院', mutationId: 7, tier: 'standard', goalType: 'rows', target: 10, star2: 9965, star3: 14358, seed: 110866 },
    { id: 15, chapter: 1, slot: 15, name: '琥珀庭院', mutationId: 1, tier: 'standard', goalType: 'color', target: 11, goalColor: 3, star2: 4060, star3: 6290, seed: 118785 },
    { id: 16, chapter: 1, slot: 16, name: '珊瑚庭院', mutationId: 7, tier: 'standard', goalType: 'special', target: 4, star2: 1845, star3: 1980, seed: 126704 },
    { id: 17, chapter: 1, slot: 17, name: '银河庭院', mutationId: 1, tier: 'strong', goalType: 'burst', target: 2, star2: 3855, star3: 4935, seed: 134623 },
    { id: 18, chapter: 1, slot: 18, name: '棉花庭院', mutationId: 7, tier: 'strong', goalType: 'stone', target: 8, star2: 200, star3: 1305, seed: 142542, stoneSeed: 1885122, stoneCount: 10 },
    { id: 19, chapter: 1, slot: 19, name: '极光庭院', mutationId: 1, tier: 'strong', goalType: 'score', target: 2950, star2: 3080, star3: 3443, seed: 150461 },
    { id: 20, chapter: 1, slot: 20, name: '终章庭院', mutationId: 7, tier: 'strong', goalType: 'score', target: 3100, star2: 3275, star3: 3415, seed: 158380 },
    { id: 21, chapter: 2, slot: 1, name: '初雪回廊', mutationId: 3, tier: 'light', goalType: 'score', target: 1800, star2: 2325, star3: 2580, seed: 166299 },
    { id: 22, chapter: 2, slot: 2, name: '糖霜回廊', mutationId: 8, tier: 'light', goalType: 'rows', target: 7, star2: 6605, star3: 7635, seed: 174218 },
    { id: 23, chapter: 2, slot: 3, name: '薄荷回廊', mutationId: 3, tier: 'light', goalType: 'color', target: 10, goalColor: 4, star2: 2430, star3: 12060, seed: 182137 },
    { id: 24, chapter: 2, slot: 4, name: '蜜橘回廊', mutationId: 8, tier: 'light', goalType: 'special', target: 2, star2: 1013, star3: 1080, seed: 190056 },
    { id: 25, chapter: 2, slot: 5, name: '青柠回廊', mutationId: 3, tier: 'light', goalType: 'burst', target: 1, star2: 2900, star3: 3010, seed: 197975 },
    { id: 26, chapter: 2, slot: 6, name: '汽水回廊', mutationId: 8, tier: 'light', goalType: 'stone', target: 10, star2: 400, star3: 2250, seed: 205894, stoneSeed: 2722954, stoneCount: 12 },
    { id: 27, chapter: 2, slot: 7, name: '葡萄回廊', mutationId: 3, tier: 'standard', goalType: 'score', target: 2500, star2: 2895, star3: 3150, seed: 213813 },
    { id: 28, chapter: 2, slot: 8, name: '星屑回廊', mutationId: 8, tier: 'standard', goalType: 'rows', target: 9, star2: 10425, star3: 15110, seed: 221732 },
    { id: 29, chapter: 2, slot: 9, name: '月牙回廊', mutationId: 3, tier: 'standard', goalType: 'color', target: 11, goalColor: 0, star2: 3445, star3: 6955, seed: 229651 },
    { id: 30, chapter: 2, slot: 10, name: '云朵回廊', mutationId: 8, tier: 'standard', goalType: 'special', target: 3, star2: 1305, star3: 1410, seed: 237570 },
    { id: 31, chapter: 2, slot: 11, name: '风铃回廊', mutationId: 3, tier: 'standard', goalType: 'burst', target: 1, star2: 2795, star3: 3010, seed: 245489 },
    { id: 32, chapter: 2, slot: 12, name: '暖阳回廊', mutationId: 8, tier: 'standard', goalType: 'stone', target: 10, star2: 740, star3: 1730, seed: 253408, stoneSeed: 3351328, stoneCount: 12 },
    { id: 33, chapter: 2, slot: 13, name: '微光回廊', mutationId: 3, tier: 'standard', goalType: 'score', target: 3350, star2: 3440, star3: 3905, seed: 261327 },
    { id: 34, chapter: 2, slot: 14, name: '涟漪回廊', mutationId: 8, tier: 'standard', goalType: 'rows', target: 10, star2: 19310, star3: 24090, seed: 269246 },
    { id: 35, chapter: 2, slot: 15, name: '琥珀回廊', mutationId: 3, tier: 'standard', goalType: 'color', target: 13, goalColor: 1, star2: 4090, star3: 9745, seed: 277165 },
    { id: 36, chapter: 2, slot: 16, name: '珊瑚回廊', mutationId: 8, tier: 'standard', goalType: 'special', target: 4, star2: 1875, star3: 2010, seed: 285084 },
    { id: 37, chapter: 2, slot: 17, name: '银河回廊', mutationId: 3, tier: 'strong', goalType: 'burst', target: 2, star2: 5114, star3: 5269, seed: 293003 },
    { id: 38, chapter: 2, slot: 18, name: '棉花回廊', mutationId: 8, tier: 'strong', goalType: 'stone', target: 10, star2: 940, star3: 2805, seed: 300922, stoneSeed: 3979702, stoneCount: 12 },
    { id: 39, chapter: 2, slot: 19, name: '极光回廊', mutationId: 3, tier: 'strong', goalType: 'score', target: 4450, star2: 4664, star3: 5373, seed: 308841 },
    { id: 40, chapter: 2, slot: 20, name: '终章回廊', mutationId: 8, tier: 'strong', goalType: 'score', target: 4700, star2: 4875, star3: 5135, seed: 316760 },
    { id: 41, chapter: 3, slot: 1, name: '初雪工坊', mutationId: 4, tier: 'light', goalType: 'score', target: 2400, star2: 2670, star3: 2785, seed: 324679 },
    { id: 42, chapter: 3, slot: 2, name: '糖霜工坊', mutationId: 6, tier: 'light', goalType: 'rows', target: 8, star2: 4805, star3: 14778, seed: 332598 },
    { id: 43, chapter: 3, slot: 3, name: '薄荷工坊', mutationId: 4, tier: 'light', goalType: 'color', target: 12, goalColor: 2, star2: 5413, star3: 6885, seed: 340517 },
    { id: 44, chapter: 3, slot: 4, name: '蜜橘工坊', mutationId: 6, tier: 'light', goalType: 'special', target: 3, star2: 1305, star3: 1415, seed: 348436 },
    { id: 45, chapter: 3, slot: 5, name: '青柠工坊', mutationId: 4, tier: 'standard', goalType: 'burst', target: 1, star2: 2690, star3: 3035, seed: 356355 },
    { id: 46, chapter: 3, slot: 6, name: '汽水工坊', mutationId: 6, tier: 'standard', goalType: 'stone', target: 12, star2: 1505, star3: 4406, seed: 364274, stoneSeed: 4817534, stoneCount: 14 },
    { id: 47, chapter: 3, slot: 7, name: '葡萄工坊', mutationId: 4, tier: 'standard', goalType: 'score', target: 3300, star2: 3455, star3: 3865, seed: 372193 },
    { id: 48, chapter: 3, slot: 8, name: '星屑工坊', mutationId: 6, tier: 'standard', goalType: 'rows', target: 10, star2: 11723, star3: 19780, seed: 380112 },
    { id: 49, chapter: 3, slot: 9, name: '月牙工坊', mutationId: 4, tier: 'standard', goalType: 'color', target: 13, goalColor: 3, star2: 2670, star3: 8591, seed: 388031 },
    { id: 50, chapter: 3, slot: 10, name: '云朵工坊', mutationId: 6, tier: 'standard', goalType: 'special', target: 4, star2: 1663, star3: 2220, seed: 395950 },
    { id: 51, chapter: 3, slot: 11, name: '风铃工坊', mutationId: 4, tier: 'standard', goalType: 'burst', target: 1, star2: 2040, star3: 2810, seed: 403869 },
    { id: 52, chapter: 3, slot: 12, name: '暖阳工坊', mutationId: 6, tier: 'standard', goalType: 'stone', target: 12, star2: 400, star3: 1845, seed: 411788, stoneSeed: 5445908, stoneCount: 14 },
    { id: 53, chapter: 3, slot: 13, name: '微光工坊', mutationId: 4, tier: 'standard', goalType: 'score', target: 4450, star2: 4630, star3: 4964, seed: 419707 },
    { id: 54, chapter: 3, slot: 14, name: '涟漪工坊', mutationId: 6, tier: 'standard', goalType: 'rows', target: 1, star2: 200, star3: 1280, seed: 427626 },
    { id: 55, chapter: 3, slot: 15, name: '琥珀工坊', mutationId: 4, tier: 'strong', goalType: 'color', target: 15, goalColor: 4, star2: 4355, star3: 5835, seed: 435545 },
    { id: 56, chapter: 3, slot: 16, name: '珊瑚工坊', mutationId: 6, tier: 'strong', goalType: 'special', target: 5, star2: 1891, star3: 1980, seed: 443464 },
    { id: 57, chapter: 3, slot: 17, name: '银河工坊', mutationId: 4, tier: 'strong', goalType: 'burst', target: 2, star2: 4653, star3: 5408, seed: 451383 },
    { id: 58, chapter: 3, slot: 18, name: '棉花工坊', mutationId: 6, tier: 'strong', goalType: 'stone', target: 12, star2: 1760, star3: 1930, seed: 459302, stoneSeed: 6074282, stoneCount: 14 },
    { id: 59, chapter: 3, slot: 19, name: '极光工坊', mutationId: 4, tier: 'strong', goalType: 'score', target: 5900, star2: 6148, star3: 6425, seed: 467221 },
    { id: 60, chapter: 3, slot: 20, name: '终章工坊', mutationId: 6, tier: 'strong', goalType: 'score', target: 6250, star2: 6460, star3: 6815, seed: 475140 },
    { id: 61, chapter: 4, slot: 1, name: '初雪糖林', mutationId: 2, tier: 'light', goalType: 'score', target: 3000, star2: 3255, star3: 3358, seed: 483059 },
    { id: 62, chapter: 4, slot: 2, name: '糖霜糖林', mutationId: 5, tier: 'light', goalType: 'rows', target: 6, star2: 24455, star3: 33138, seed: 490978 },
    { id: 63, chapter: 4, slot: 3, name: '薄荷糖林', mutationId: 2, tier: 'light', goalType: 'color', target: 14, goalColor: 0, star2: 4338, star3: 5070, seed: 498897 },
    { id: 64, chapter: 4, slot: 4, name: '蜜橘糖林', mutationId: 5, tier: 'light', goalType: 'special', target: 3, star2: 1305, star3: 1306, seed: 506816 },
    { id: 65, chapter: 4, slot: 5, name: '青柠糖林', mutationId: 2, tier: 'standard', goalType: 'burst', target: 2, star2: 5083, star3: 5690, seed: 514735 },
    { id: 66, chapter: 4, slot: 6, name: '汽水糖林', mutationId: 5, tier: 'standard', goalType: 'stone', target: 14, star2: 1040, star3: 2525, seed: 522654, stoneSeed: 6912114, stoneCount: 16 },
    { id: 67, chapter: 4, slot: 7, name: '葡萄糖林', mutationId: 2, tier: 'standard', goalType: 'score', target: 4150, star2: 4215, star3: 4640, seed: 530573 },
    { id: 68, chapter: 4, slot: 8, name: '星屑糖林', mutationId: 5, tier: 'standard', goalType: 'rows', target: 4, star2: 36941, star3: 39970, seed: 538492 },
    { id: 69, chapter: 4, slot: 9, name: '月牙糖林', mutationId: 2, tier: 'standard', goalType: 'color', target: 15, goalColor: 1, star2: 4490, star3: 9165, seed: 546411 },
    { id: 70, chapter: 4, slot: 10, name: '云朵糖林', mutationId: 5, tier: 'standard', goalType: 'special', target: 4, star2: 1530, star3: 1875, seed: 554330 },
    { id: 71, chapter: 4, slot: 11, name: '风铃糖林', mutationId: 2, tier: 'standard', goalType: 'burst', target: 2, star2: 4578, star3: 5043, seed: 562249 },
    { id: 72, chapter: 4, slot: 12, name: '暖阳糖林', mutationId: 5, tier: 'standard', goalType: 'stone', target: 14, star2: 400, star3: 401, seed: 570168, stoneSeed: 7540488, stoneCount: 16 },
    { id: 73, chapter: 4, slot: 13, name: '微光糖林', mutationId: 2, tier: 'strong', goalType: 'score', target: 5600, star2: 5840, star3: 6155, seed: 578087 },
    { id: 74, chapter: 4, slot: 14, name: '涟漪糖林', mutationId: 5, tier: 'strong', goalType: 'rows', target: 4, star2: 20943, star3: 28349, seed: 586006 },
    { id: 75, chapter: 4, slot: 15, name: '琥珀糖林', mutationId: 2, tier: 'strong', goalType: 'color', target: 17, goalColor: 2, star2: 6290, star3: 9728, seed: 593925 },
    { id: 76, chapter: 4, slot: 16, name: '珊瑚糖林', mutationId: 5, tier: 'strong', goalType: 'special', target: 5, star2: 1890, star3: 2085, seed: 601844 },
    { id: 77, chapter: 4, slot: 17, name: '银河糖林', mutationId: 2, tier: 'strong', goalType: 'burst', target: 3, star2: 7300, star3: 7568, seed: 609763 },
    { id: 78, chapter: 4, slot: 18, name: '棉花糖林', mutationId: 5, tier: 'strong', goalType: 'stone', target: 14, star2: 1040, star3: 2765, seed: 617682, stoneSeed: 8168862, stoneCount: 16 },
    { id: 79, chapter: 4, slot: 19, name: '极光糖林', mutationId: 2, tier: 'strong', goalType: 'score', target: 7400, star2: 7770, star3: 8365, seed: 625601 },
    { id: 80, chapter: 4, slot: 20, name: '终章糖林', mutationId: 5, tier: 'strong', goalType: 'score', target: 7800, star2: 7905, star3: 8130, seed: 633520 },
    { id: 81, chapter: 5, slot: 1, name: '初雪实验室', mutationId: 1, tier: 'standard', goalType: 'score', target: 3800, star2: 3975, star3: 4145, seed: 641439 },
    { id: 82, chapter: 5, slot: 2, name: '糖霜实验室', mutationId: 3, tier: 'standard', goalType: 'rows', target: 10, star2: 50600, star3: 92903, seed: 649358 },
    { id: 83, chapter: 5, slot: 3, name: '薄荷实验室', mutationId: 6, tier: 'standard', goalType: 'color', target: 16, goalColor: 3, star2: 3005, star3: 4940, seed: 657277 },
    { id: 84, chapter: 5, slot: 4, name: '蜜橘实验室', mutationId: 8, tier: 'standard', goalType: 'special', target: 4, star2: 2220, star3: 2221, seed: 665196 },
    { id: 85, chapter: 5, slot: 5, name: '青柠实验室', mutationId: 1, tier: 'standard', goalType: 'burst', target: 2, star2: 4695, star3: 5450, seed: 673115 },
    { id: 86, chapter: 5, slot: 6, name: '汽水实验室', mutationId: 3, tier: 'standard', goalType: 'stone', target: 14, star2: 1280, star3: 1415, seed: 681034, stoneSeed: 9006694, stoneCount: 16 },
    { id: 87, chapter: 5, slot: 7, name: '葡萄实验室', mutationId: 6, tier: 'standard', goalType: 'score', target: 5250, star2: 5563, star3: 5635, seed: 688953 },
    { id: 88, chapter: 5, slot: 8, name: '星屑实验室', mutationId: 8, tier: 'standard', goalType: 'rows', target: 10, star2: 13558, star3: 19763, seed: 696872 },
    { id: 89, chapter: 5, slot: 9, name: '月牙实验室', mutationId: 1, tier: 'standard', goalType: 'color', target: 17, goalColor: 4, star2: 6610, star3: 8438, seed: 704791 },
    { id: 90, chapter: 5, slot: 10, name: '云朵实验室', mutationId: 3, tier: 'standard', goalType: 'special', target: 5, star2: 2895, star3: 3000, seed: 712710 },
    { id: 91, chapter: 5, slot: 11, name: '风铃实验室', mutationId: 6, tier: 'strong', goalType: 'burst', target: 2, star2: 4928, star3: 5215, seed: 720629 },
    { id: 92, chapter: 5, slot: 12, name: '暖阳实验室', mutationId: 8, tier: 'strong', goalType: 'stone', target: 14, star2: 600, star3: 2135, seed: 728548, stoneSeed: 9635068, stoneCount: 16 },
    { id: 93, chapter: 5, slot: 13, name: '微光实验室', mutationId: 1, tier: 'strong', goalType: 'score', target: 7050, star2: 7343, star3: 7463, seed: 736467 },
    { id: 94, chapter: 5, slot: 14, name: '涟漪实验室', mutationId: 3, tier: 'strong', goalType: 'rows', target: 10, star2: 26856, star3: 53498, seed: 744386 },
    { id: 95, chapter: 5, slot: 15, name: '琥珀实验室', mutationId: 6, tier: 'strong', goalType: 'color', target: 19, goalColor: 0, star2: 3035, star3: 5105, seed: 752305 },
    { id: 96, chapter: 5, slot: 16, name: '珊瑚实验室', mutationId: 8, tier: 'strong', goalType: 'special', target: 6, star2: 2555, star3: 3228, seed: 760224 },
    { id: 97, chapter: 5, slot: 17, name: '银河实验室', mutationId: 1, tier: 'strong', goalType: 'burst', target: 3, star2: 7415, star3: 9260, seed: 768143 },
    { id: 98, chapter: 5, slot: 18, name: '棉花实验室', mutationId: 3, tier: 'strong', goalType: 'stone', target: 14, star2: 940, star3: 1835, seed: 776062, stoneSeed: 10263442, stoneCount: 16 },
    { id: 99, chapter: 5, slot: 19, name: '极光实验室', mutationId: 6, tier: 'strong', goalType: 'score', target: 9350, star2: 9468, star3: 9563, seed: 783981 },
    { id: 100, chapter: 5, slot: 20, name: '终章实验室', mutationId: 8, tier: 'strong', goalType: 'score', target: 9900, star2: 10043, star3: 10093, seed: 791900 },
    { id: 101, chapter: 6, slot: 1, name: '初雪剧场', mutationId: 4, tier: 'standard', goalType: 'score', target: 4600, star2: 4925, star3: 5053, seed: 799819 },
    { id: 102, chapter: 6, slot: 2, name: '糖霜剧场', mutationId: 5, tier: 'standard', goalType: 'rows', target: 5, star2: 24618, star3: 41604, seed: 807738 },
    { id: 103, chapter: 6, slot: 3, name: '薄荷剧场', mutationId: 7, tier: 'standard', goalType: 'color', target: 18, goalColor: 1, star2: 4618, star3: 7005, seed: 815657 },
    { id: 104, chapter: 6, slot: 4, name: '蜜橘剧场', mutationId: 2, tier: 'standard', goalType: 'special', target: 4, star2: 1875, star3: 1876, seed: 823576 },
    { id: 105, chapter: 6, slot: 5, name: '青柠剧场', mutationId: 4, tier: 'standard', goalType: 'burst', target: 2, star2: 4913, star3: 5515, seed: 831495 },
    { id: 106, chapter: 6, slot: 6, name: '汽水剧场', mutationId: 5, tier: 'standard', goalType: 'stone', target: 14, star2: 1040, star3: 1280, seed: 839414, stoneSeed: 11101274, stoneCount: 16 },
    { id: 107, chapter: 6, slot: 7, name: '葡萄剧场', mutationId: 7, tier: 'strong', goalType: 'score', target: 6350, star2: 6495, star3: 7130, seed: 847333 },
    { id: 108, chapter: 6, slot: 8, name: '星屑剧场', mutationId: 2, tier: 'strong', goalType: 'rows', target: 10, star2: 10530, star3: 15838, seed: 855252 },
    { id: 109, chapter: 6, slot: 9, name: '月牙剧场', mutationId: 4, tier: 'strong', goalType: 'color', target: 19, goalColor: 2, star2: 4450, star3: 17508, seed: 863171 },
    { id: 110, chapter: 6, slot: 10, name: '云朵剧场', mutationId: 5, tier: 'strong', goalType: 'special', target: 5, star2: 1725, star3: 1770, seed: 871090 },
    { id: 111, chapter: 6, slot: 11, name: '风铃剧场', mutationId: 7, tier: 'strong', goalType: 'burst', target: 2, star2: 4153, star3: 4730, seed: 879009 },
    { id: 112, chapter: 6, slot: 12, name: '暖阳剧场', mutationId: 2, tier: 'strong', goalType: 'stone', target: 14, star2: 1160, star3: 1585, seed: 886928, stoneSeed: 11729648, stoneCount: 16 },
    { id: 113, chapter: 6, slot: 13, name: '微光剧场', mutationId: 4, tier: 'strong', goalType: 'score', target: 8550, star2: 8768, star3: 9030, seed: 894847 },
    { id: 114, chapter: 6, slot: 14, name: '涟漪剧场', mutationId: 5, tier: 'strong', goalType: 'rows', target: 5, star2: 23960, star3: 41382, seed: 902766 },
    { id: 115, chapter: 6, slot: 15, name: '琥珀剧场', mutationId: 7, tier: 'strong', goalType: 'color', target: 20, goalColor: 3, star2: 6988, star3: 12300, seed: 910685 },
    { id: 116, chapter: 6, slot: 16, name: '珊瑚剧场', mutationId: 2, tier: 'strong', goalType: 'special', target: 6, star2: 2475, star3: 3015, seed: 918604 },
    { id: 117, chapter: 6, slot: 17, name: '银河剧场', mutationId: 4, tier: 'strong', goalType: 'burst', target: 3, star2: 8020, star3: 8115, seed: 926523 },
    { id: 118, chapter: 6, slot: 18, name: '棉花剧场', mutationId: 5, tier: 'strong', goalType: 'stone', target: 14, star2: 1040, star3: 1640, seed: 934442, stoneSeed: 12358022, stoneCount: 16 },
    { id: 119, chapter: 6, slot: 19, name: '极光剧场', mutationId: 7, tier: 'strong', goalType: 'score', target: 11300, star2: 11614, star3: 11775, seed: 942361 },
    { id: 120, chapter: 6, slot: 20, name: '终章剧场', mutationId: 2, tier: 'strong', goalType: 'score', target: 11950, star2: 12515, star3: 13350, seed: 950280 },
];

export const CHAPTERS = [
    { id: 1, name: '糖霜庭院', base: 1200 },
    { id: 2, name: '镜厅回廊', base: 1800 },
    { id: 3, name: '倒悬工坊', base: 2400 },
    { id: 4, name: '迷雾糖林', base: 3000 },
    { id: 5, name: '棱镜实验室', base: 3800 },
    { id: 6, name: '终局剧场', base: 4600 },
] as const;

export function levelById(id: number): LevelEntry | null {
    return LEVELS.find((l) => l.id === id) ?? null;
}

/** 本章拿到 ≥1★ 的关卡数（解锁下一章用：≥12） */
export function chapterCleared(stars: Record<number, number>, chapter: number): number {
    let n = 0;
    for (let s = 1; s <= 20; s++) {
        const id = (chapter - 1) * 20 + s;
        if ((stars[id] ?? 0) > 0) n++;
    }
    return n;
}

export function chapterUnlocked(stars: Record<number, number>, chapter: number): boolean {
    if (chapter <= 1) return true;
    return chapterCleared(stars, chapter - 1) >= 12;
}
