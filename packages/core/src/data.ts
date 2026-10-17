// 天干地支的固定表。规则见 spec/bazi-rules.v1.md。

export type Element = 0 | 1 | 2 | 3 | 4; // 木 火 土 金 水（相生顺序：木→火→土→金→水）
export const ELEMENTS = ["wood", "fire", "earth", "metal", "water"] as const;

export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const STEM_IDS = ["jia", "yi", "bing", "ding", "wu", "ji", "geng", "xin", "ren", "gui"] as const;
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
export const BRANCH_IDS = ["zi", "chou", "yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai"] as const;

/** 天干的五行：甲乙木、丙丁火、戊己土、庚辛金、壬癸水。 */
export const stemElement = (s: number): Element => Math.floor(s / 2) as Element;
/** 阳干 = 偶数下标（甲丙戊庚壬）。 */
export const stemIsYang = (s: number): boolean => s % 2 === 0;

/** 地支藏干：[本气, 中气, 余气]，下标指向 STEMS。 */
export const HIDDEN_STEMS: readonly (readonly number[])[] = [
  [9],        // 子：癸
  [5, 9, 7],  // 丑：己 癸 辛
  [0, 2, 4],  // 寅：甲 丙 戊
  [1],        // 卯：乙
  [4, 1, 9],  // 辰：戊 乙 癸
  [2, 6, 4],  // 巳：丙 庚 戊
  [3, 5],     // 午：丁 己
  [5, 3, 1],  // 未：己 丁 乙
  [6, 8, 4],  // 申：庚 壬 戊
  [7],        // 酉：辛
  [4, 7, 3],  // 戌：戊 辛 丁
  [8, 0],     // 亥：壬 甲
];

export const TEN_GODS = [
  "companion", "rob_wealth", "eating_god", "hurting_officer", "indirect_wealth",
  "direct_wealth", "seven_killings", "direct_officer", "indirect_resource", "direct_resource",
] as const;
export type TenGod = (typeof TEN_GODS)[number];
export const TEN_GODS_ZH: Record<TenGod, string> = {
  companion: "比肩", rob_wealth: "劫财", eating_god: "食神", hurting_officer: "伤官",
  indirect_wealth: "偏财", direct_wealth: "正财", seven_killings: "七杀", direct_officer: "正官",
  indirect_resource: "偏印", direct_resource: "正印",
};

/** 以日主 dm 看另一个天干 s 是哪一个十神。 */
export function tenGod(dm: number, s: number): TenGod {
  const a = stemElement(dm);
  const b = stemElement(s);
  const same = stemIsYang(dm) === stemIsYang(s);
  if (a === b) return same ? "companion" : "rob_wealth";
  if ((a + 1) % 5 === b) return same ? "eating_god" : "hurting_officer"; // 我生
  if ((a + 2) % 5 === b) return same ? "indirect_wealth" : "direct_wealth"; // 我克
  if ((b + 2) % 5 === a) return same ? "seven_killings" : "direct_officer"; // 克我
  return same ? "indirect_resource" : "direct_resource"; // 生我
}

/** 四面具的固定顺序：年柱、月柱、日柱、时柱。 */
export const MASK_ORDER = ["social_face", "work_mode", "private_self", "inner_drive"] as const;
