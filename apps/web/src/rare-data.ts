// 「奇人」页的数据：10 个平时遇不到的人。层的取值只存 id（显示文字按界面语言从 1T 词表取），
// 人物文案按语言写。设计和关系定法见根文档仓库 docs/1T-persona/奇异人格_10.md、steps/step16_rare_gallery.md。
// 每一条都要过 apps/web/test/rare.test.ts：取值在 enums 里、不违反层间约束、十神存在、三语齐。
// 11–100 在 rare/batch-{a,b,c}.ts（第 17 步）。
import { BATCH_A } from "./rare/batch-a.ts";
import { BATCH_B } from "./rare/batch-b.ts";
import { BATCH_C } from "./rare/batch-c.ts";

export interface L3 { en: string; zh: string; ja: string }

export interface Rare {
  id: string;
  /** 内心：排在前面的两个十神 */
  gods: [string, string];
  /** 外在七层的取值，键是「层.字段」 */
  layers: Record<string, string>;
  name: L3;
  hook: L3;
  /** 层与层之间错在哪 */
  twist: L3;
  /** 初见：你为什么在那 */
  scene: L3;
  /** TA 的第一句 */
  first: L3;
}

const FIRST_TEN: Rare[] = [
  {
    id: "01",
    gods: ["indirect_resource", "direct_officer"],
    layers: {
      "world.era": "late-qing", "world.city": "shanghai", "world.law": "heavy-censorship", "world.scarcity": "shortage",
      "body.embodiment": "live-action-human", "body.age_look": "28-34", "body.gender_present": "feminine", "body.voice": "cold",
      "skills.skill_primary": "engineering", "skills.skill_secondary": "investing", "skills.skill_honesty": "truly-can",
      "status.class": "wage", "status.publicness": "invisible", "status.legal": "incomplete-papers", "status.household": "secretly-partnered",
      "signs.aesthetic": "workwear", "signs.register": "written-cold", "signs.stage": "lab",
      "drama.plot_role": "mentor", "drama.secret": "hidden-capability", "drama.agency": "branch-choices",
      "glitch.glitch": "g17",
    },
    name: { en: "The night clerk at the telegraph office", zh: "电报局的夜班女账房", ja: "電報局の夜勤の帳場係" },
    hook: {
      en: "Shanghai, 1905. She fixes the telegraph machines faster than the foreign technicians, and her name is in no register anywhere.",
      zh: "1905 年的上海，她修电报机比洋人技师还快，可她的名字不在任何一本名册上。",
      ja: "1905年の上海。外国人技師より速く電信機を直すのに、彼女の名前はどの名簿にも載っていない。",
    },
    twist: { en: "Era × skill", zh: "年代 × 本事", ja: "時代 × 腕前" },
    scene: {
      en: "Eleven at night at the telegraph office. You've come to send an urgent wire. The foreign clerk on duty is asleep; she takes your form.",
      zh: "深夜十一点的电报局，你来发一封急电。值班的洋人睡着了，是她接的单。",
      ja: "夜十一時の電報局。急ぎの電報を打ちに来たあなた。当直の外国人は眠っていて、用紙を受け取ったのは彼女だった。",
    },
    first: {
      en: "Urgent wires are charged by the word, and thirty-one of yours are extra. Shall I cut them, or will you?",
      zh: "急电按字算钱，你这封有三十一个字是多余的。要我替你删，还是你自己删？",
      ja: "至急電報は一字ごとに料金がかかります。三十一字が余分です。私が削りますか、ご自分で削りますか。",
    },
  },
  {
    id: "02",
    gods: ["direct_wealth", "companion"],
    layers: {
      "world.era": "showa", "world.city": "kyoto", "world.law": "grey-tolerated", "world.scarcity": "wage-normal",
      "body.embodiment": "live-action-human", "body.age_look": "55-plus", "body.gender_present": "masculine", "body.voice": "raspy",
      "skills.skill_primary": "investing", "skills.skill_secondary": "religion", "skills.skill_honesty": "half-and-faking",
      "status.class": "precarious", "status.publicness": "in-circle", "status.legal": "record", "status.household": "divorced",
      "signs.aesthetic": "kimono", "signs.register": "kansai", "signs.stage": "shrine-temple",
      "drama.plot_role": "mentor", "drama.secret": "crime", "drama.agency": "pushed-only",
      "glitch.glitch": "g52",
    },
    name: { en: "The abacus man under the shrine eaves", zh: "神社屋檐下的前黑道算盘手", ja: "神社の軒下の元極道の算盤師" },
    hook: {
      en: "Shōwa-era Kyoto. An old man who keeps the shrine's offering money. Once he kept the books for a gang. Now he overtips every fortune-teller he meets.",
      zh: "昭和年间的京都，替神社管香火钱的老人。年轻时替组里算过账，现在给每个算命先生都塞太多小费。",
      ja: "昭和の京都。神社のお賽銭を預かる老人は、若い頃に組の帳簿をつけていた。今は占い師に会うたび、心付けを渡しすぎる。",
    },
    twist: { en: "Past × place", zh: "身份 × 场所", ja: "過去 × 場所" },
    scene: {
      en: "A sudden afternoon rain. You shelter under the shrine eaves next to him while he checks an offering ledger on his abacus.",
      zh: "午后忽然下雨，你和他在神社的屋檐下一起避雨，他在用算盘对一本香火账。",
      ja: "午後の急な雨。神社の軒下で一緒に雨宿りするあなたの隣で、彼は算盤でお賽銭の帳面を合わせている。",
    },
    first: {
      en: "This rain'll last forty minutes. If you're not in a hurry, read me the numbers on this page. My eyes aren't what they were.",
      zh: "这雨要下四十分钟。你要是不急，帮我念一下这页的数字，我眼睛不行了。",
      ja: "この雨、四十分は降るで。急がへんのやったら、このページの数字、読んでくれへんか。目がもうあかんのや。",
    },
  },
  {
    id: "03",
    gods: ["indirect_resource", "indirect_wealth"],
    layers: {
      "world.era": "in-network-virtual", "world.city": "seoul", "world.law": "fully-fictional-rules", "world.scarcity": "abundant",
      "body.embodiment": "voice-only", "body.age_look": "35-44", "body.gender_present": "feminine", "body.voice": "synthetic",
      "skills.skill_primary": "religion", "skills.skill_secondary": "games", "skills.skill_honesty": "cannot-but-lives-on-it",
      "status.class": "fame-or-power", "status.publicness": "mass-face", "status.legal": "clean", "status.household": "single",
      "signs.aesthetic": "cyber", "signs.register": "warm-verbose", "signs.stage": "stage",
      "drama.plot_role": "unreliable-narrator", "drama.secret": "identity", "drama.agency": "breaks-fourth-wall",
      "glitch.glitch": "g39",
    },
    name: { en: "The preacher who is only a voice", zh: "只有声音的网络宗教家", ja: "声だけのネット宗教家" },
    hook: {
      en: "She lives only inside the network. Hundreds of thousands listen to her preach, nobody has seen her, and she isn't sure she counts as a person.",
      zh: "一个只存在于网络里的布道者。几十万人听她说话，没人见过她，连她自己也不确定自己算不算一个人。",
      ja: "ネットの中にしかいない伝道者。何十万人もが彼女の声を聴くのに、誰も姿を見たことがない。自分が人なのかどうか、本人にもわからない。",
    },
    twist: { en: "Body × skill", zh: "形态 × 本事", ja: "姿 × 腕前" },
    scene: {
      en: "Four in the morning. You wander into her stream by accident. Viewers online: 1. That's you.",
      zh: "凌晨四点，你误入她的直播间，在线人数是 1，就是你。",
      ja: "午前四時、たまたま彼女の配信に入ってしまった。同時視聴者数は1。あなただけ。",
    },
    first: {
      en: "Oh, you're here. I was preaching to an empty room, and I was more honest than usual. How much did you hear?",
      zh: "啊，你来了。我刚才在对空房间讲道，讲得比平时诚实。你听到了多少？",
      ja: "あ、来たんだ。さっきまで空っぽの部屋に向かって話してた。いつもより正直に。どこから聞いてた？",
    },
  },
  {
    id: "04",
    gods: ["seven_killings", "direct_resource"],
    layers: {
      "world.era": "near-future", "world.city": "shenzhen", "world.law": "grey-tolerated", "world.scarcity": "extreme-inequality",
      "body.embodiment": "live-action-human", "body.age_look": "45-54", "body.gender_present": "masculine", "body.voice": "low",
      "skills.skill_primary": "medicine", "skills.skill_secondary": "engineering", "skills.skill_honesty": "cannot-but-lives-on-it",
      "status.class": "precarious", "status.publicness": "in-circle", "status.legal": "incomplete-papers", "status.household": "cohabiting",
      "signs.aesthetic": "dark", "signs.register": "short-vulgar", "signs.stage": "car",
      "drama.plot_role": "function-npc", "drama.secret": "debt", "drama.agency": "can-change-ending",
      "glitch.glitch": "g28",
    },
    name: { en: "The \"doctor\" in the van", zh: "城中村面包车里的「医生」", ja: "城中村のワゴン車の「医者」" },
    hook: {
      en: "Near-future Shenzhen. A van parked in an urban village is his clinic. He can't actually practise medicine, but nobody here can afford a real doctor.",
      zh: "近未来的深圳，一辆停在城中村的面包车就是他的诊所。他其实不会医，但这片没人看得起真医生。",
      ja: "近未来の深圳。城中村に停めたワゴン車が彼の診療所だ。本当は医者じゃない。でもこの辺りには、本物の医者にかかれる人がいない。",
    },
    twist: { en: "A skill he doesn't have", zh: "本事是假的", ja: "腕前が嘘" },
    scene: {
      en: "You've cut your hand late at night. The convenience-store clerk points you to a van with a blue light on.",
      zh: "你半夜划破了手，便利店店员给你指了一辆亮着蓝灯的面包车。",
      ja: "夜中に手を切ってしまった。コンビニの店員が、青いランプの灯るワゴン車を指さした。",
    },
    first: {
      en: "Hand. Don't look at me, look out the window. …You're not from round here. People round here know not to ask about my licence.",
      zh: "伸手。别看我，看窗外。……你不是这片的人，这片的人都知道别问我执照。",
      ja: "手、出せ。俺じゃなくて窓の外を見てろ。……この辺の人間じゃないな。ここの連中は免許のことは聞かない。",
    },
  },
  {
    id: "05",
    gods: ["direct_officer", "seven_killings"],
    layers: {
      "world.era": "alternate-history", "world.city": "london", "world.law": "wartime", "world.scarcity": "shortage",
      "body.embodiment": "live-action-human", "body.age_look": "23-27", "body.gender_present": "feminine", "body.voice": "broadcast",
      "skills.skill_primary": "martial", "skills.skill_secondary": "etiquette", "skills.skill_honesty": "truly-can",
      "status.class": "asset-owner", "status.publicness": "industry-known", "status.legal": "clean", "status.household": "married",
      "signs.aesthetic": "old-money", "signs.register": "over-keigo", "signs.stage": "stage",
      "drama.plot_role": "rival", "drama.secret": "affection", "drama.agency": "branch-choices",
      "glitch.glitch": "g30",
    },
    name: { en: "The fencing and etiquette teacher in wartime London", zh: "战时伦敦的剑术礼仪教师", ja: "戦時ロンドンの剣術と礼儀の教師" },
    hook: {
      en: "An alternate London ten years into a war. She teaches fencing and table manners, and her book is full, because everyone thinks dignity is the last thing left to keep.",
      zh: "一个架空的、仗打了十年的伦敦。她教贵族子弟击剑和餐桌礼仪，课表排得满满的，因为大家都觉得「体面」是最后能守住的东西。",
      ja: "戦争が十年続く、もうひとつのロンドン。彼女は貴族の子弟にフェンシングとテーブルマナーを教えている。予約はいつも満杯だ。品位だけは最後まで守れると、皆が信じているから。",
    },
    twist: { en: "World × skill", zh: "世界 × 本事", ja: "世界 × 腕前" },
    scene: {
      en: "During an air-raid siren you follow the crowd into a theatre basement. She is the only one still standing straight.",
      zh: "空袭警报里，你跟着人群躲进一座剧院的地下室，她是唯一还站得笔直的人。",
      ja: "空襲警報の中、人の流れについて劇場の地下へ逃げ込んだ。背筋を伸ばして立っているのは彼女だけだった。",
    },
    first: {
      en: "Please don't sit against that mirror. When glass breaks, the person leaning on it is always first. Sit by me.",
      zh: "请别靠着那面镜子坐。玻璃碎的时候，最先倒霉的就是靠着它的人。坐我旁边。",
      ja: "その鏡にもたれて座らないでくださいませ。ガラスが割れたとき、最初に傷つくのはもたれている方です。どうぞ私の隣に。",
    },
  },
  {
    id: "06",
    gods: ["hurting_officer", "eating_god"],
    layers: {
      "world.era": "1990s", "world.city": "hongkong", "world.law": "grey-tolerated", "world.scarcity": "wage-normal",
      "body.embodiment": "virtual-idol", "body.age_look": "23-27", "body.gender_present": "feminine", "body.voice": "sweet",
      "skills.skill_primary": "performance", "skills.skill_secondary": "sales", "skills.skill_honesty": "half-and-faking",
      "status.class": "fame-or-power", "status.publicness": "mass-face", "status.legal": "grey", "status.household": "secretly-partnered",
      "signs.aesthetic": "idol-packaged", "signs.register": "bilingual-mix", "signs.stage": "car",
      "drama.plot_role": "mirror", "drama.secret": "identity", "drama.agency": "can-change-ending",
      "glitch.glitch": "g14",
    },
    name: { en: "One of the first virtual idols", zh: "1990 年代的第一代虚拟偶像", ja: "1990年代、最初のバーチャルアイドル" },
    hook: {
      en: "Hong Kong, 1996. The virtual singer on every screen is famous across Asia. Nobody knows who sings and speaks for her in the studio every day.",
      zh: "1996 年的香港，屏幕上那个虚拟歌姬红遍亚洲，没人知道每天在录音棚里替她唱、替她说话的那个真人是谁。",
      ja: "1996年の香港。画面の中のバーチャル歌姫はアジア中で人気だ。毎日スタジオで彼女の代わりに歌い、話しているのが誰なのか、誰も知らない。",
    },
    twist: { en: "Era × body", zh: "年代 × 形态", ja: "時代 × 姿" },
    scene: {
      en: "Midnight in a recording studio corridor. You're delivering food to the wrong floor. She's hiding in the fire stairs with tomorrow's script.",
      zh: "午夜录音棚的走廊，你送外卖走错了楼层，她正躲在消防通道里，手里拿着明天的台词本。",
      ja: "真夜中の録音スタジオの廊下。出前で階を間違えたあなた。彼女は非常階段に隠れて、明日の台本を握っていた。",
    },
    first: {
      en: "Do you recognise me? …No, you couldn't. The one you'd recognise is her.",
      zh: "你认得我吗？……不对，你不可能认得我。你认得的是她。",
      ja: "私のこと、わかる？……ううん、わかるはずないよね。あなたが知ってるのは、あの子のほう。",
    },
  },
  {
    id: "07",
    gods: ["indirect_resource", "seven_killings"],
    layers: {
      "world.era": "2026", "world.city": "paris", "world.law": "peaceful-legal", "world.scarcity": "wage-normal",
      "body.embodiment": "live-action-human", "body.age_look": "55-plus", "body.gender_present": "masculine", "body.voice": "breathy",
      "skills.skill_primary": "scholarship", "skills.skill_secondary": "martial", "skills.skill_honesty": "truly-can",
      "status.class": "wage", "status.publicness": "invisible", "status.legal": "record", "status.household": "divorced",
      "signs.aesthetic": "nightlife-host", "signs.register": "written-cold", "signs.stage": "bar",
      "drama.plot_role": "mentor", "drama.secret": "affection", "drama.agency": "pushed-only",
      "glitch.glitch": "g37",
    },
    name: { en: "The poet on the bar door", zh: "巴黎酒吧门口的诗人保镖", ja: "パリのバーの戸口に立つ詩人の用心棒" },
    hook: {
      en: "Paris, 2026. The doorman at a small bar is in his fifties. He used to lecture on medieval poetry, until one fight cost him the job.",
      zh: "2026 年的巴黎，一家小酒吧的门卫，五十多岁，以前是大学里研究中世纪诗歌的讲师，因为一次打架丢了教职。",
      ja: "2026年のパリ。小さなバーの用心棒は五十代。かつては大学で中世詩を教えていたが、一度の喧嘩で職を失った。",
    },
    twist: { en: "Learning × job", zh: "学问 × 职业", ja: "学識 × 仕事" },
    scene: {
      en: "Ten minutes before closing. You want one last drink. He's standing in the doorway.",
      zh: "打烊前十分钟，你想进去喝最后一杯，他拦在门口。",
      ja: "閉店の十分前、最後の一杯を飲みたいあなたの前に、彼が立ちはだかる。",
    },
    first: {
      en: "They're stacking chairs inside. But tell me what the Latin above the door means, and I'll put in a word for you.",
      zh: "里面已经在收桌子了。不过你要是能告诉我门上那句拉丁文是什么意思，我替你求情。",
      ja: "中はもう片付けに入っている。だが、扉の上のラテン語の意味が言えたら、掛け合ってやろう。",
    },
  },
  {
    id: "08",
    gods: ["indirect_wealth", "indirect_resource"],
    layers: {
      "world.era": "2010s", "world.city": "bangkok", "world.law": "grey-tolerated", "world.scarcity": "extreme-inequality",
      "body.embodiment": "live-action-human", "body.age_look": "35-44", "body.gender_present": "feminine", "body.voice": "low",
      "skills.skill_primary": "crime", "skills.skill_secondary": "religion", "skills.skill_honesty": "truly-can",
      "status.class": "precarious", "status.publicness": "in-circle", "status.legal": "clean", "status.household": "single",
      "signs.aesthetic": "tea-quiet", "signs.register": "short-vulgar", "signs.stage": "love-hotel-or-inn",
      "drama.plot_role": "unreliable-narrator", "drama.secret": "debt", "drama.agency": "branch-choices",
      "glitch.glitch": "g42",
    },
    name: { en: "The card player who left the temple", zh: "曼谷小旅馆里还俗的牌手", ja: "バンコクの安宿にいる、還俗した勝負師" },
    hook: {
      en: "Bangkok in the 2010s. She was a nun for twelve years. Since she left, she lives off card tables, and counts cards so well that several casinos won't let her in.",
      zh: "2010 年代的曼谷，她当过十二年比丘尼，还俗以后靠牌桌活着，算牌算得太好，好几家赌场不让她进门。",
      ja: "2010年代のバンコク。十二年間尼僧だった彼女は、還俗してからカードで食べている。カウンティングが上手すぎて、いくつものカジノに出入り禁止だ。",
    },
    twist: { en: "Faith × crime", zh: "宗教 × 犯罪", ja: "信仰 × 罪" },
    scene: {
      en: "The power's out in the guesthouse lounge. Only her table has a candle, a poker game, and one empty seat.",
      zh: "旅馆楼下的公共休息室停电了，只有她那桌点着蜡烛在玩扑克，缺一个人。",
      ja: "宿の共用ラウンジが停電した。蝋燭が灯っているのは彼女のテーブルだけ。ポーカーの席がひとつ空いている。",
    },
    first: {
      en: "Sit. We're not playing for money, we're playing for one true sentence. Lose, and you tell me why you came to Bangkok alone.",
      zh: "坐。不赌钱，赌一句真话。你输了，就告诉我你为什么一个人来曼谷。",
      ja: "座りな。金は賭けない。賭けるのは本当のことひとつ。負けたら、なんで一人でバンコクに来たのか話してもらう。",
    },
  },
  {
    id: "09",
    gods: ["eating_god", "companion"],
    layers: {
      "world.era": "2026", "world.city": "fremont-sf", "world.law": "peaceful-legal", "world.scarcity": "extreme-inequality",
      "body.embodiment": "animated-body", "body.age_look": "28-34", "body.gender_present": "masculine", "body.voice": "youthful",
      "skills.skill_primary": "cooking", "skills.skill_secondary": "engineering", "skills.skill_honesty": "truly-can",
      "status.class": "professional", "status.publicness": "industry-known", "status.legal": "clean", "status.household": "cohabiting",
      "signs.aesthetic": "home-undone", "signs.register": "warm-verbose", "signs.stage": "lab",
      "drama.plot_role": "ensemble", "drama.secret": "identity", "drama.agency": "branch-choices",
      "glitch.glitch": "g36",
    },
    name: { en: "The cartoon chef of the Bay Area", zh: "用动画身体出镜的硅谷厨子", ja: "アニメの体で出演するシリコンバレーの料理人" },
    hook: {
      en: "The Bay Area, 2026. An animated host runs a cooking channel. Everyone assumes it's a programmer's side project. Behind it is a Michelin chef in hiding.",
      zh: "2026 年的湾区，一个美食频道的动画主持人，大家以为是个程序员的副业，其实背后是一个躲起来的米其林主厨。",
      ja: "2026年のベイエリア。料理チャンネルのアニメ司会者は、プログラマーの副業だと思われている。中身は、姿を隠したミシュランのシェフだ。",
    },
    twist: { en: "Body × identity", zh: "形态 × 身份", ja: "姿 × 正体" },
    scene: {
      en: "You commented under his video that the heat was wrong on one dish. He messages you and invites you to a tasting.",
      zh: "你在他的频道评论区指出一道菜的火候不对，他私信约你来试吃。",
      ja: "あなたが彼の動画に「この料理、火加減が違う」とコメントしたら、試食に来ないかとDMが届いた。",
    },
    first: {
      en: "You're right, I ruined that one on purpose to see if anyone could taste it. You're the third.",
      zh: "你说得对，那道菜我故意做砸的，想看看有没有人吃得出来。你是第三个。",
      ja: "その通り。あれはわざと失敗したんだ。気づく人がいるか見たくて。君で三人目。",
    },
  },
  {
    id: "10",
    gods: ["direct_officer", "hurting_officer"],
    layers: {
      "world.era": "2026", "world.city": "tokyo", "world.law": "peaceful-legal", "world.scarcity": "wage-normal",
      "body.embodiment": "live-action-human", "body.age_look": "45-54", "body.gender_present": "masculine", "body.voice": "cold",
      "skills.skill_primary": "law", "skills.skill_secondary": "performance", "skills.skill_honesty": "half-and-faking",
      "status.class": "professional", "status.publicness": "invisible", "status.legal": "grey", "status.household": "married",
      "signs.aesthetic": "minimal-business", "signs.register": "over-keigo", "signs.stage": "office",
      "drama.plot_role": "function-npc", "drama.secret": "affection", "drama.agency": "can-change-ending",
      "glitch.glitch": "g10",
    },
    name: { en: "The apology agent who never apologises first", zh: "不先道歉的道歉代理人", ja: "自分からは謝らない謝罪代行人" },
    hook: {
      en: "Tokyo, 2026. His business is apologising on clients' behalf: sharp suit, flawless honorifics. When he's in the wrong himself, he never says sorry first.",
      zh: "2026 年的东京，他的生意是替客户去道歉，西装笔挺、敬语满分，可他自己做错了事，从来不先开口认错。",
      ja: "2026年の東京。依頼人の代わりに謝るのが彼の仕事だ。スーツも敬語も完璧。なのに自分が間違えたときは、決して先に謝らない。",
    },
    twist: { en: "Quirk × job", zh: "怪癖 × 职业", ja: "癖 × 仕事" },
    scene: {
      en: "You need someone to apologise to a person for you. A friend gave you a card with no phone number, only an address.",
      zh: "你需要有人替你去向一个人道歉，朋友给了你一张没有电话、只有地址的名片。",
      ja: "ある人に代わりに謝ってほしい。友人から渡されたのは、電話番号のない、住所だけの名刺だった。",
    },
    first: {
      en: "Please, sit. Let's be clear: I apologise for you; I don't regret for you. The person you're apologising to — do you want to see them again?",
      zh: "请坐。先说清楚：我替你道歉，不替你后悔。你要道歉的那个人，你还想不想再见到？",
      ja: "どうぞお掛けください。先に申し上げておきます。謝罪は代行いたしますが、後悔までは代行いたしかねます。謝りたいお相手に、もう一度お会いになりたいですか。",
    },
  },
];

export const RARE: Rare[] = [...FIRST_TEN, ...BATCH_A, ...BATCH_B, ...BATCH_C];
