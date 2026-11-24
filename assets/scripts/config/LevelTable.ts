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
    { id: 1, chapter: 1, slot: 1, name: '初雪庭院', mutationId: 1, tier: 'light', goalType: 'score', target: 1200, star2: 1700, star3: 18450, seed: 7919 },
    { id: 2, chapter: 1, slot: 2, name: '糖霜庭院', mutationId: 7, tier: 'light', goalType: 'rows', target: 1, star2: 1550, star3: 16950, seed: 15838 },
    { id: 3, chapter: 1, slot: 3, name: '薄荷庭院', mutationId: 1, tier: 'light', goalType: 'color', target: 8, goalColor: 1, star2: 1600, star3: 18250, seed: 23757 },
    { id: 4, chapter: 1, slot: 4, name: '蜜橘庭院', mutationId: 7, tier: 'light', goalType: 'special', target: 2, star2: 1700, star3: 17850, seed: 31676 },
    { id: 5, chapter: 1, slot: 5, name: '青柠庭院', mutationId: 1, tier: 'light', goalType: 'burst', target: 1, star2: 1800, star3: 17950, seed: 39595 },
    { id: 6, chapter: 1, slot: 6, name: '汽水庭院', mutationId: 7, tier: 'light', goalType: 'stone', target: 3, star2: 1850, star3: 18050, seed: 47514, stoneSeed: 628374, stoneCount: 5 },
    { id: 7, chapter: 1, slot: 7, name: '葡萄庭院', mutationId: 1, tier: 'light', goalType: 'score', target: 1650, star2: 2300, star3: 17900, seed: 55433 },
    { id: 8, chapter: 1, slot: 8, name: '星屑庭院', mutationId: 7, tier: 'light', goalType: 'rows', target: 1, star2: 2100, star3: 17300, seed: 63352 },
    { id: 9, chapter: 1, slot: 9, name: '月牙庭院', mutationId: 1, tier: 'standard', goalType: 'color', target: 9, goalColor: 2, star2: 2200, star3: 17650, seed: 71271 },
    { id: 10, chapter: 1, slot: 10, name: '云朵庭院', mutationId: 7, tier: 'standard', goalType: 'special', target: 3, star2: 2350, star3: 18300, seed: 79190 },
    { id: 11, chapter: 1, slot: 11, name: '风铃庭院', mutationId: 1, tier: 'standard', goalType: 'burst', target: 1, star2: 2450, star3: 17500, seed: 87109 },
    { id: 12, chapter: 1, slot: 12, name: '暖阳庭院', mutationId: 7, tier: 'standard', goalType: 'stone', target: 8, star2: 2550, star3: 16850, seed: 95028, stoneSeed: 1256748, stoneCount: 10 },
    { id: 13, chapter: 1, slot: 13, name: '微光庭院', mutationId: 1, tier: 'standard', goalType: 'score', target: 2250, star2: 3150, star3: 16900, seed: 102947 },
    { id: 14, chapter: 1, slot: 14, name: '涟漪庭院', mutationId: 7, tier: 'standard', goalType: 'rows', target: 2, star2: 2800, star3: 17150, seed: 110866 },
    { id: 15, chapter: 1, slot: 15, name: '琥珀庭院', mutationId: 1, tier: 'standard', goalType: 'color', target: 11, goalColor: 3, star2: 2950, star3: 17800, seed: 118785 },
    { id: 16, chapter: 1, slot: 16, name: '珊瑚庭院', mutationId: 7, tier: 'standard', goalType: 'special', target: 4, star2: 3100, star3: 18050, seed: 126704 },
    { id: 17, chapter: 1, slot: 17, name: '银河庭院', mutationId: 1, tier: 'strong', goalType: 'burst', target: 2, star2: 3250, star3: 17800, seed: 134623 },
    { id: 18, chapter: 1, slot: 18, name: '棉花庭院', mutationId: 7, tier: 'strong', goalType: 'stone', target: 8, star2: 3350, star3: 18350, seed: 142542, stoneSeed: 1885122, stoneCount: 10 },
    { id: 19, chapter: 1, slot: 19, name: '极光庭院', mutationId: 1, tier: 'strong', goalType: 'score', target: 2950, star2: 4150, star3: 18400, seed: 150461 },
    { id: 20, chapter: 1, slot: 20, name: '终章庭院', mutationId: 7, tier: 'strong', goalType: 'score', target: 3100, star2: 4350, star3: 17800, seed: 158380 },
    { id: 21, chapter: 2, slot: 1, name: '初雪回廊', mutationId: 3, tier: 'light', goalType: 'score', target: 1800, star2: 2500, star3: 17500, seed: 166299 },
    { id: 22, chapter: 2, slot: 2, name: '糖霜回廊', mutationId: 8, tier: 'light', goalType: 'rows', target: 3, star2: 2300, star3: 17100, seed: 174218 },
    { id: 23, chapter: 2, slot: 3, name: '薄荷回廊', mutationId: 3, tier: 'light', goalType: 'color', target: 10, goalColor: 4, star2: 2400, star3: 17400, seed: 182137 },
    { id: 24, chapter: 2, slot: 4, name: '蜜橘回廊', mutationId: 8, tier: 'light', goalType: 'special', target: 2, star2: 2550, star3: 18400, seed: 190056 },
    { id: 25, chapter: 2, slot: 5, name: '青柠回廊', mutationId: 3, tier: 'light', goalType: 'burst', target: 1, star2: 2700, star3: 17600, seed: 197975 },
    { id: 26, chapter: 2, slot: 6, name: '汽水回廊', mutationId: 8, tier: 'light', goalType: 'stone', target: 4, star2: 2800, star3: 16950, seed: 205894, stoneSeed: 2722954, stoneCount: 6 },
    { id: 27, chapter: 2, slot: 7, name: '葡萄回廊', mutationId: 3, tier: 'standard', goalType: 'score', target: 2500, star2: 3500, star3: 17750, seed: 213813 },
    { id: 28, chapter: 2, slot: 8, name: '星屑回廊', mutationId: 8, tier: 'standard', goalType: 'rows', target: 2, star2: 3150, star3: 16650, seed: 221732 },
    { id: 29, chapter: 2, slot: 9, name: '月牙回廊', mutationId: 3, tier: 'standard', goalType: 'color', target: 11, goalColor: 0, star2: 3350, star3: 17250, seed: 229651 },
    { id: 30, chapter: 2, slot: 10, name: '云朵回廊', mutationId: 8, tier: 'standard', goalType: 'special', target: 3, star2: 3500, star3: 17350, seed: 237570 },
    { id: 31, chapter: 2, slot: 11, name: '风铃回廊', mutationId: 3, tier: 'standard', goalType: 'burst', target: 1, star2: 3650, star3: 17100, seed: 245489 },
    { id: 32, chapter: 2, slot: 12, name: '暖阳回廊', mutationId: 8, tier: 'standard', goalType: 'stone', target: 4, star2: 3850, star3: 17200, seed: 253408, stoneSeed: 3351328, stoneCount: 6 },
    { id: 33, chapter: 2, slot: 13, name: '微光回廊', mutationId: 3, tier: 'standard', goalType: 'score', target: 3350, star2: 4700, star3: 18300, seed: 261327 },
    { id: 34, chapter: 2, slot: 14, name: '涟漪回廊', mutationId: 8, tier: 'standard', goalType: 'rows', target: 1, star2: 4200, star3: 17450, seed: 269246 },
    { id: 35, chapter: 2, slot: 15, name: '琥珀回廊', mutationId: 3, tier: 'standard', goalType: 'color', target: 13, goalColor: 1, star2: 4400, star3: 17850, seed: 277165 },
    { id: 36, chapter: 2, slot: 16, name: '珊瑚回廊', mutationId: 8, tier: 'standard', goalType: 'special', target: 4, star2: 4600, star3: 17800, seed: 285084 },
    { id: 37, chapter: 2, slot: 17, name: '银河回廊', mutationId: 3, tier: 'strong', goalType: 'burst', target: 2, star2: 4850, star3: 17250, seed: 293003 },
    { id: 38, chapter: 2, slot: 18, name: '棉花回廊', mutationId: 8, tier: 'strong', goalType: 'stone', target: 4, star2: 5050, star3: 17700, seed: 300922, stoneSeed: 3979702, stoneCount: 6 },
    { id: 39, chapter: 2, slot: 19, name: '极光回廊', mutationId: 3, tier: 'strong', goalType: 'score', target: 4450, star2: 6250, star3: 17650, seed: 308841 },
    { id: 40, chapter: 2, slot: 20, name: '终章回廊', mutationId: 8, tier: 'strong', goalType: 'score', target: 4700, star2: 6600, star3: 17950, seed: 316760 },
    { id: 41, chapter: 3, slot: 1, name: '初雪工坊', mutationId: 4, tier: 'light', goalType: 'score', target: 2400, star2: 3350, star3: 17850, seed: 324679 },
    { id: 42, chapter: 3, slot: 2, name: '糖霜工坊', mutationId: 6, tier: 'light', goalType: 'rows', target: 1, star2: 3050, star3: 17550, seed: 332598 },
    { id: 43, chapter: 3, slot: 3, name: '薄荷工坊', mutationId: 4, tier: 'light', goalType: 'color', target: 12, goalColor: 2, star2: 3250, star3: 18000, seed: 340517 },
    { id: 44, chapter: 3, slot: 4, name: '蜜橘工坊', mutationId: 6, tier: 'light', goalType: 'special', target: 3, star2: 3400, star3: 18100, seed: 348436 },
    { id: 45, chapter: 3, slot: 5, name: '青柠工坊', mutationId: 4, tier: 'standard', goalType: 'burst', target: 1, star2: 3550, star3: 11700, seed: 356355 },
    { id: 46, chapter: 3, slot: 6, name: '汽水工坊', mutationId: 6, tier: 'standard', goalType: 'stone', target: 11, star2: 3750, star3: 18050, seed: 364274, stoneSeed: 4817534, stoneCount: 13 },
    { id: 47, chapter: 3, slot: 7, name: '葡萄工坊', mutationId: 4, tier: 'standard', goalType: 'score', target: 3300, star2: 4600, star3: 18250, seed: 372193 },
    { id: 48, chapter: 3, slot: 8, name: '星屑工坊', mutationId: 6, tier: 'standard', goalType: 'rows', target: 1, star2: 4200, star3: 17100, seed: 380112 },
    { id: 49, chapter: 3, slot: 9, name: '月牙工坊', mutationId: 4, tier: 'standard', goalType: 'color', target: 13, goalColor: 3, star2: 4450, star3: 16650, seed: 388031 },
    { id: 50, chapter: 3, slot: 10, name: '云朵工坊', mutationId: 6, tier: 'standard', goalType: 'special', target: 4, star2: 4650, star3: 18300, seed: 395950 },
    { id: 51, chapter: 3, slot: 11, name: '风铃工坊', mutationId: 4, tier: 'standard', goalType: 'burst', target: 1, star2: 2100, star3: 12600, seed: 403869 },
    { id: 52, chapter: 3, slot: 12, name: '暖阳工坊', mutationId: 6, tier: 'standard', goalType: 'stone', target: 5, star2: 5150, star3: 18150, seed: 411788, stoneSeed: 5445908, stoneCount: 7 },
    { id: 53, chapter: 3, slot: 13, name: '微光工坊', mutationId: 4, tier: 'standard', goalType: 'score', target: 4450, star2: 6250, star3: 17450, seed: 419707 },
    { id: 54, chapter: 3, slot: 14, name: '涟漪工坊', mutationId: 6, tier: 'standard', goalType: 'rows', target: 2, star2: 5600, star3: 18100, seed: 427626 },
    { id: 55, chapter: 3, slot: 15, name: '琥珀工坊', mutationId: 4, tier: 'strong', goalType: 'color', target: 15, goalColor: 4, star2: 1300, star3: 12250, seed: 435545 },
    { id: 56, chapter: 3, slot: 16, name: '珊瑚工坊', mutationId: 6, tier: 'strong', goalType: 'special', target: 5, star2: 6150, star3: 18900, seed: 443464 },
    { id: 57, chapter: 3, slot: 17, name: '银河工坊', mutationId: 4, tier: 'strong', goalType: 'burst', target: 1, star2: 750, star3: 9700, seed: 451383 },
    { id: 58, chapter: 3, slot: 18, name: '棉花工坊', mutationId: 6, tier: 'strong', goalType: 'stone', target: 4, star2: 6750, star3: 17700, seed: 459302, stoneSeed: 6074282, stoneCount: 6 },
    { id: 59, chapter: 3, slot: 19, name: '极光工坊', mutationId: 4, tier: 'strong', goalType: 'score', target: 5900, star2: 8250, star3: 17350, seed: 467221 },
    { id: 60, chapter: 3, slot: 20, name: '终章工坊', mutationId: 6, tier: 'strong', goalType: 'score', target: 6250, star2: 8750, star3: 18350, seed: 475140 },
    { id: 61, chapter: 4, slot: 1, name: '初雪糖林', mutationId: 2, tier: 'light', goalType: 'score', target: 3000, star2: 4200, star3: 18300, seed: 483059 },
    { id: 62, chapter: 4, slot: 2, name: '糖霜糖林', mutationId: 5, tier: 'light', goalType: 'rows', target: 2, star2: 3800, star3: 16950, seed: 490978 },
    { id: 63, chapter: 4, slot: 3, name: '薄荷糖林', mutationId: 2, tier: 'light', goalType: 'color', target: 14, goalColor: 0, star2: 4050, star3: 17400, seed: 498897 },
    { id: 64, chapter: 4, slot: 4, name: '蜜橘糖林', mutationId: 5, tier: 'light', goalType: 'special', target: 3, star2: 4250, star3: 17650, seed: 506816 },
    { id: 65, chapter: 4, slot: 5, name: '青柠糖林', mutationId: 2, tier: 'standard', goalType: 'burst', target: 2, star2: 4450, star3: 17650, seed: 514735 },
    { id: 66, chapter: 4, slot: 6, name: '汽水糖林', mutationId: 5, tier: 'standard', goalType: 'stone', target: 6, star2: 4700, star3: 18000, seed: 522654, stoneSeed: 6912114, stoneCount: 8 },
    { id: 67, chapter: 4, slot: 7, name: '葡萄糖林', mutationId: 2, tier: 'standard', goalType: 'score', target: 4150, star2: 5800, star3: 18100, seed: 530573 },
    { id: 68, chapter: 4, slot: 8, name: '星屑糖林', mutationId: 5, tier: 'standard', goalType: 'rows', target: 2, star2: 5250, star3: 16600, seed: 538492 },
    { id: 69, chapter: 4, slot: 9, name: '月牙糖林', mutationId: 2, tier: 'standard', goalType: 'color', target: 15, goalColor: 1, star2: 5550, star3: 17800, seed: 546411 },
    { id: 70, chapter: 4, slot: 10, name: '云朵糖林', mutationId: 5, tier: 'standard', goalType: 'special', target: 4, star2: 5850, star3: 18800, seed: 554330 },
    { id: 71, chapter: 4, slot: 11, name: '风铃糖林', mutationId: 2, tier: 'standard', goalType: 'burst', target: 2, star2: 6100, star3: 17400, seed: 562249 },
    { id: 72, chapter: 4, slot: 12, name: '暖阳糖林', mutationId: 5, tier: 'standard', goalType: 'stone', target: 6, star2: 6400, star3: 18100, seed: 570168, stoneSeed: 7540488, stoneCount: 8 },
    { id: 73, chapter: 4, slot: 13, name: '微光糖林', mutationId: 2, tier: 'strong', goalType: 'score', target: 5600, star2: 7850, star3: 18250, seed: 578087 },
    { id: 74, chapter: 4, slot: 14, name: '涟漪糖林', mutationId: 5, tier: 'strong', goalType: 'rows', target: 2, star2: 7000, star3: 16300, seed: 586006 },
    { id: 75, chapter: 4, slot: 15, name: '琥珀糖林', mutationId: 2, tier: 'strong', goalType: 'color', target: 17, goalColor: 2, star2: 7350, star3: 18800, seed: 593925 },
    { id: 76, chapter: 4, slot: 16, name: '珊瑚糖林', mutationId: 5, tier: 'strong', goalType: 'special', target: 5, star2: 7700, star3: 18250, seed: 601844 },
    { id: 77, chapter: 4, slot: 17, name: '银河糖林', mutationId: 2, tier: 'strong', goalType: 'burst', target: 3, star2: 8050, star3: 16800, seed: 609763 },
    { id: 78, chapter: 4, slot: 18, name: '棉花糖林', mutationId: 5, tier: 'strong', goalType: 'stone', target: 5, star2: 8400, star3: 17250, seed: 617682, stoneSeed: 8168862, stoneCount: 7 },
    { id: 79, chapter: 4, slot: 19, name: '极光糖林', mutationId: 2, tier: 'strong', goalType: 'score', target: 7400, star2: 10350, star3: 17400, seed: 625601 },
    { id: 80, chapter: 4, slot: 20, name: '终章糖林', mutationId: 5, tier: 'strong', goalType: 'score', target: 7800, star2: 10900, star3: 18000, seed: 633520 },
    { id: 81, chapter: 5, slot: 1, name: '初雪实验室', mutationId: 1, tier: 'standard', goalType: 'score', target: 3800, star2: 5300, star3: 17050, seed: 641439 },
    { id: 82, chapter: 5, slot: 2, name: '糖霜实验室', mutationId: 3, tier: 'standard', goalType: 'rows', target: 2, star2: 4850, star3: 16850, seed: 649358 },
    { id: 83, chapter: 5, slot: 3, name: '薄荷实验室', mutationId: 6, tier: 'standard', goalType: 'color', target: 16, goalColor: 3, star2: 5100, star3: 18350, seed: 657277 },
    { id: 84, chapter: 5, slot: 4, name: '蜜橘实验室', mutationId: 8, tier: 'standard', goalType: 'special', target: 4, star2: 5400, star3: 17400, seed: 665196 },
    { id: 85, chapter: 5, slot: 5, name: '青柠实验室', mutationId: 1, tier: 'standard', goalType: 'burst', target: 2, star2: 5650, star3: 17750, seed: 673115 },
    { id: 86, chapter: 5, slot: 6, name: '汽水实验室', mutationId: 3, tier: 'standard', goalType: 'stone', target: 4, star2: 5950, star3: 16950, seed: 681034, stoneSeed: 9006694, stoneCount: 6 },
    { id: 87, chapter: 5, slot: 7, name: '葡萄实验室', mutationId: 6, tier: 'standard', goalType: 'score', target: 5250, star2: 7350, star3: 18450, seed: 688953 },
    { id: 88, chapter: 5, slot: 8, name: '星屑实验室', mutationId: 8, tier: 'standard', goalType: 'rows', target: 3, star2: 6650, star3: 16150, seed: 696872 },
    { id: 89, chapter: 5, slot: 9, name: '月牙实验室', mutationId: 1, tier: 'standard', goalType: 'color', target: 17, goalColor: 4, star2: 7000, star3: 17850, seed: 704791 },
    { id: 90, chapter: 5, slot: 10, name: '云朵实验室', mutationId: 3, tier: 'standard', goalType: 'special', target: 5, star2: 7400, star3: 17550, seed: 712710 },
    { id: 91, chapter: 5, slot: 11, name: '风铃实验室', mutationId: 6, tier: 'strong', goalType: 'burst', target: 2, star2: 7750, star3: 18300, seed: 720629 },
    { id: 92, chapter: 5, slot: 12, name: '暖阳实验室', mutationId: 8, tier: 'strong', goalType: 'stone', target: 1, star2: 8100, star3: 17650, seed: 728548, stoneSeed: 9635068, stoneCount: 3 },
    { id: 93, chapter: 5, slot: 13, name: '微光实验室', mutationId: 1, tier: 'strong', goalType: 'score', target: 7050, star2: 9850, star3: 17900, seed: 736467 },
    { id: 94, chapter: 5, slot: 14, name: '涟漪实验室', mutationId: 3, tier: 'strong', goalType: 'rows', target: 1, star2: 8850, star3: 17450, seed: 744386 },
    { id: 95, chapter: 5, slot: 15, name: '琥珀实验室', mutationId: 6, tier: 'strong', goalType: 'color', target: 19, goalColor: 0, star2: 9300, star3: 17950, seed: 752305 },
    { id: 96, chapter: 5, slot: 16, name: '珊瑚实验室', mutationId: 8, tier: 'strong', goalType: 'special', target: 6, star2: 9750, star3: 17700, seed: 760224 },
    { id: 97, chapter: 5, slot: 17, name: '银河实验室', mutationId: 1, tier: 'strong', goalType: 'burst', target: 3, star2: 10200, star3: 17250, seed: 768143 },
    { id: 98, chapter: 5, slot: 18, name: '棉花实验室', mutationId: 3, tier: 'strong', goalType: 'stone', target: 1, star2: 10650, star3: 18250, seed: 776062, stoneSeed: 10263442, stoneCount: 3 },
    { id: 99, chapter: 5, slot: 19, name: '极光实验室', mutationId: 6, tier: 'strong', goalType: 'score', target: 9350, star2: 13100, star3: 18700, seed: 783981 },
    { id: 100, chapter: 5, slot: 20, name: '终章实验室', mutationId: 8, tier: 'strong', goalType: 'score', target: 9900, star2: 13850, star3: 19800, seed: 791900 },
    { id: 101, chapter: 6, slot: 1, name: '初雪剧场', mutationId: 4, tier: 'standard', goalType: 'score', target: 4600, star2: 6450, star3: 18150, seed: 799819 },
    { id: 102, chapter: 6, slot: 2, name: '糖霜剧场', mutationId: 5, tier: 'standard', goalType: 'rows', target: 1, star2: 5850, star3: 17500, seed: 807738 },
    { id: 103, chapter: 6, slot: 3, name: '薄荷剧场', mutationId: 7, tier: 'standard', goalType: 'color', target: 18, goalColor: 1, star2: 6200, star3: 18500, seed: 815657 },
    { id: 104, chapter: 6, slot: 4, name: '蜜橘剧场', mutationId: 2, tier: 'standard', goalType: 'special', target: 4, star2: 6500, star3: 18300, seed: 823576 },
    { id: 105, chapter: 6, slot: 5, name: '青柠剧场', mutationId: 4, tier: 'standard', goalType: 'burst', target: 2, star2: 6850, star3: 12500, seed: 831495 },
    { id: 106, chapter: 6, slot: 6, name: '汽水剧场', mutationId: 5, tier: 'standard', goalType: 'stone', target: 1, star2: 7200, star3: 18750, seed: 839414, stoneSeed: 11101274, stoneCount: 3 },
    { id: 107, chapter: 6, slot: 7, name: '葡萄剧场', mutationId: 7, tier: 'strong', goalType: 'score', target: 6350, star2: 8900, star3: 18700, seed: 847333 },
    { id: 108, chapter: 6, slot: 8, name: '星屑剧场', mutationId: 2, tier: 'strong', goalType: 'rows', target: 1, star2: 8050, star3: 17850, seed: 855252 },
    { id: 109, chapter: 6, slot: 9, name: '月牙剧场', mutationId: 4, tier: 'strong', goalType: 'color', target: 19, goalColor: 2, star2: 8500, star3: 14950, seed: 863171 },
    { id: 110, chapter: 6, slot: 10, name: '云朵剧场', mutationId: 5, tier: 'strong', goalType: 'special', target: 5, star2: 8950, star3: 17850, seed: 871090 },
    { id: 111, chapter: 6, slot: 11, name: '风铃剧场', mutationId: 7, tier: 'strong', goalType: 'burst', target: 2, star2: 9400, star3: 18400, seed: 879009 },
    { id: 112, chapter: 6, slot: 12, name: '暖阳剧场', mutationId: 2, tier: 'strong', goalType: 'stone', target: 1, star2: 9850, star3: 17100, seed: 886928, stoneSeed: 11729648, stoneCount: 3 },
    { id: 113, chapter: 6, slot: 13, name: '微光剧场', mutationId: 4, tier: 'strong', goalType: 'score', target: 8550, star2: 11950, star3: 18100, seed: 894847 },
    { id: 114, chapter: 6, slot: 14, name: '涟漪剧场', mutationId: 5, tier: 'strong', goalType: 'rows', target: 1, star2: 10700, star3: 17650, seed: 902766 },
    { id: 115, chapter: 6, slot: 15, name: '琥珀剧场', mutationId: 7, tier: 'strong', goalType: 'color', target: 20, goalColor: 3, star2: 11250, star3: 18150, seed: 910685 },
    { id: 116, chapter: 6, slot: 16, name: '珊瑚剧场', mutationId: 2, tier: 'strong', goalType: 'special', target: 6, star2: 11800, star3: 18350, seed: 918604 },
    { id: 117, chapter: 6, slot: 17, name: '银河剧场', mutationId: 4, tier: 'strong', goalType: 'burst', target: 1, star2: 5050, star3: 18550, seed: 926523 },
    { id: 118, chapter: 6, slot: 18, name: '棉花剧场', mutationId: 5, tier: 'strong', goalType: 'stone', target: 4, star2: 12900, star3: 19400, seed: 934442, stoneSeed: 12358022, stoneCount: 6 },
    { id: 119, chapter: 6, slot: 19, name: '极光剧场', mutationId: 7, tier: 'strong', goalType: 'score', target: 11300, star2: 15800, star3: 22600, seed: 942361 },
    { id: 120, chapter: 6, slot: 20, name: '终章剧场', mutationId: 2, tier: 'strong', goalType: 'score', target: 11950, star2: 16750, star3: 23900, seed: 950280 },
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
