/**
 * Long-form documentation of the scoring algorithm, rendered by /method.
 *
 * Kept out of `lib/i18n.ts` on purpose: this is a document, not UI copy. Each
 * locale is typed against `MethodDoc`, so a missing or mistyped block fails the
 * type check instead of silently rendering as an empty section.
 */

import type { Lang } from "@/lib/i18n";

export type MethodBlock =
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "formula"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "link"; text: string; href: string }
  | { kind: "table"; head: string[]; rows: string[][] };

export interface MethodDocSection {
  /** Anchor id, also used by the table of contents. */
  id: string;
  heading: string;
  blocks: MethodBlock[];
}

export interface MethodDoc {
  title: string;
  lead: string;
  toc: string;
  back: string;
  sections: MethodDocSection[];
}

const zh: MethodDoc = {
  title: "评分算法",
  lead:
    "本站的评分完全由公开数据与固定公式产生，不调用任何 AI 模型，也不包含主观判断。这一页把两层算法、每一个权重、每一条规则和它们的来源完整写出来，便于逐项核对。",
  toc: "本页目录",
  back: "返回评分",
  sections: [
    {
      id: "overview",
      heading: "概论",
      blocks: [
        {
          kind: "p",
          text:
            "评分分两层。第一层针对单部电影，输出 0-100 分；第二层针对四部电影组成的 Top 4 Build，同样输出 0-100 分。两层之间是单向依赖的：单部分数会作为 Build 质量维度的输入，但 Build 的最终得分不会反过来改变任何一部电影的单部分数。",
        },
        {
          kind: "p",
          text:
            "之所以要分两层，是因为「四部好电影」和「一个好的 Top 4」并不是同一件事。如果只看平均分，那么四部公认杰作永远是最优解，四部作品之间的关系会被完全忽略。所以在第二层里，单部质量的权重被刻意压到 25%，其余 75% 用来衡量这四部电影之间的关系：跨度有多宽、彼此有没有可计算的联系、这套选择是否呈现出某种整体倾向。",
        },
        {
          kind: "p",
          text:
            "整套算法是确定性的：相同的输入永远得到相同的输出，不涉及随机数、不涉及生成式模型，也不使用任何用户画像或行为数据。",
        },
      ],
    },
    {
      id: "sources",
      heading: "数据源与选用理由",
      blocks: [
        {
          kind: "p",
          text:
            "算法一共使用四类外部数据。每一类只取它最擅长的那部分字段，避免同一条信息被重复计入。",
        },
        {
          kind: "table",
          head: ["数据源", "使用的字段", "选用理由"],
          rows: [
            [
              "TMDB",
              "vote_average、vote_count、popularity、genres、release_date、revenue、production_countries、production_companies、original_language、director、keywords、belongs_to_collection",
              "观众评分与文化传播度，以及多样性分析所需的类型、地区、语言、导演与关键词",
            ],
            [
              "IMDb",
              "rating、vote_count",
              "观众样本量最大的电影评分数据库，投票数远超 TMDB",
            ],
            [
              "奥斯卡",
              "最佳影片与最佳导演的获奖记录、其他类别获奖数量",
              "辨识度最高的行业认可信号",
            ],
            [
              "三大电影节",
              "金棕榈、金狮、金熊，以及评审团大奖、评审团奖、最佳导演等九类奖项",
              "影史意义明确的国际认可",
            ],
            [
              "TSPDT 影史 Top 1000",
              "排名",
              "覆盖面最广的影史地位指标",
            ],
            [
              "TSPDT 21 世纪",
              "排名",
              "只含 2000 年后上映的电影，用来补偿当代电影——新片在历史总榜上天然吃亏",
            ],
            [
              "Sight & Sound 影评人榜",
              "排名",
              "最权威的影史榜单之一，代表评论界的长期共识",
            ],
            [
              "《电影手册》年度十佳",
              "排名",
              "当代法国作者主义批评视角，对近年新片的认可比历史榜单更及时",
            ],
          ],
        },
        {
          kind: "p",
          text:
            "刻意不使用的字段：预算与片长。预算高低与一部电影在影史中的位置没有稳定关系；片长对品味评价没有解释力。把它们计入只会增加噪声，不会提高区分度。",
        },
      ],
    },
    {
      id: "film",
      heading: "第一层 · 单部电影评分（0-100）",
      blocks: [
        {
          kind: "p",
          text:
            "单部分数由四个维度加权求和得到。每个维度先各自归一化到 0-100，再乘以权重相加，最后整体乘以 100。",
        },
        {
          kind: "formula",
          text:
            "总分 = (观众评分 × 0.20 + 影史地位 × 0.35 + 奖项认可 × 0.20 + 文化传播度 × 0.25) × 100",
        },
        { kind: "h3", text: "维度 1 · 观众评分（权重 20%）" },
        {
          kind: "p",
          text:
            "主数据源是 IMDb 评分。直接使用算术平均会有一个众所周知的问题：只有几百人投票的 9.2 分，可信度远不如十万人投票的 8.8 分。因此先做贝叶斯收缩，把评分朝总体均值方向拉，票数越少拉得越狠。",
        },
        {
          kind: "formula",
          text:
            "WeightedRating = (v / (v + m)) × R + (m / (v + m)) × C\n\nR = IMDb 评分\nv = IMDb 票数\nC = 6.8  参考总体均值\nm = 25000  可信度阈值",
        },
        {
          kind: "p",
          text:
            "收缩后的评分再映射到 0-100。映射区间取 5.0 至 9.0，而不是 0 至 10：真实电影的加权评分几乎不会低于 5.0，用满量程会让所有电影挤在高分段，失去区分度。",
        },
        {
          kind: "formula",
          text: "IMDbScore = clamp(100 × (WeightedRating − 5.0) / 4.0, 0, 100)",
        },
        {
          kind: "p",
          text:
            "票数本身也参与本维度，但权重很小，因为票数还会在文化传播度维度中单独使用。这里如果给足权重，等于把同一条信息计算两遍。",
        },
        {
          kind: "formula",
          text:
            "VoteCredibility = clamp(100 × log10(1 + v) / log10(1 + 1,000,000), 0, 100)\nIMDbStrength = 0.85 × IMDbScore + 0.15 × VoteCredibility",
        },
        {
          kind: "p",
          text:
            "最后用 TMDB 评分做交叉验证。TMDB 的样本量小于 IMDb，口味也更偏大众，因此只占 30%，作用是在 IMDb 可能出现极端值时提供校正。",
        },
        {
          kind: "formula",
          text:
            "TMDBScore = clamp(tmdb_rating × 10, 0, 100)\n观众评分 = 0.70 × IMDbStrength + 0.30 × TMDBScore",
        },

        { kind: "h3", text: "维度 2 · 影史地位（权重 35%，最高）" },
        {
          kind: "p",
          text:
            "这是权重最高的维度，因为影史榜单聚合的是数千名影评人与导演的长期共识，不受短期热度与宣发影响。它由四个子项相加而成，满分合计 28 分，再折算为百分制。",
        },
        {
          kind: "table",
          head: ["子项", "满分", "计算方式"],
          rows: [
            ["TSPDT 影史 Top 1000", "13 分", "第 1 名 = 13 分，第 1000 名 = 4.55 分，递减且保底 35%"],
            ["TSPDT 21 世纪", "6 分", "仅 2000 年及以后上映的电影适用；第 1 名 = 6 分，第 1000 名 = 2.1 分，递减且保底 35%"],
            ["Sight & Sound 影评人榜", "4 分", "第 1 名 = 4 分，第 250 名 = 1.4 分，递减且保底 35%"],
            ["《电影手册》年度十佳", "5 分", "第 1 名 = 5 分，第 10 名 = 1.75 分，递减且保底 35%"],
          ],
        },
        {
          kind: "p",
          text:
            "所有榜单共用同一条递减公式：第 1 名拿满该子项的全部分数，之后等距递减，但不会降到 0 —— 榜尾保留该子项 35% 的分数。名次会被夹到 [1, 榜长] 区间内，超出榜长的名次按榜尾计算，不会产生负分。",
        },
        {
          kind: "formula",
          text:
            "RankPoints = maxPoints × (0.35 + 0.65 × (listLength − clamp(rank, 1, listLength)) / (listLength − 1))",
        },
        {
          kind: "p",
          text:
            "为什么不一路降到 0：一份千名的榜单若线性归零，几百名之后全部贴近 0 分。实测在 200 部随机抽样里，44% 的影片在这个权重最高的维度上得 0 分，分布的中段因此被压平，总分实际变成了「知名度」的排序，而不是「影史地位」的排序。保留 35% 的保底后，名次差异依然起作用——同一张千名榜上第 1 名仍是第 1000 名的 2.9 倍——但长榜的尾段也能贡献分数。「入榜但排在末位」与「从未入榜」仍然分得开：只有后者才是 0。",
        },
        {
          kind: "p",
          text:
            "上面这些名次都换算成百分制后再按 35% 计入总分，但分母不是固定的 28 分：TSPDT 21 世纪榜只收录 2000 年及以后上映的电影，一部更早的电影根本不可能出现在这张榜上，所以它的名次属于「未知」而不是「没有」。此时这 6 分会连同分母一起被剔除，该片实际按 22 分折算影史地位。这样一部 1963 年的经典不会因为「上不了 21 世纪榜」而被扣掉 6 分；反过来，2000 年后上映的电影若确实没上榜，那就是「已核实为无」，按 0 分计、分母保持 28 分。免除的前提是能确认这部电影不可能入榜，所以上映年份未知的电影不享受免除，仍按满额 28 分计算。",
        },
        {
          kind: "p",
          text:
            "TSPDT Top 1000 占了最重的 13 分，因为它是覆盖面最广的多源聚合榜。TSPDT 21 世纪榜用来补偿当代电影。Sight & Sound 影评人榜代表评论界的长期共识。",
        },
        {
          kind: "p",
          text:
            "《电影手册》年度十佳提供的是当代法国作者主义批评视角，它的价值在于及时：去年的新片几乎不可能立刻登上 TSPDT，却可能已经出现在手册的年度十佳里。四个子项合起来，长期共识与当代判断都被覆盖到。",
        },

        { kind: "h3", text: "维度 3 · 奖项认可（权重 20%）" },
        {
          kind: "formula",
          text: "奖项认可 = 0.50 × 奥斯卡 + 0.35 × 电影节 + 0.15 × 奖项广度",
        },
        {
          kind: "p",
          text:
            "奥斯卡部分只统计获奖，完全不使用提名数据。三类获奖相加后按 15 分满分折算。奖项与影史地位同一口径：榜单库里没有记录的影片，奖项按 0 分计，不当作未知剔除。",
        },
        {
          kind: "table",
          head: ["事件", "分值"],
          rows: [
            ["最佳影片获奖", "8 分"],
            ["最佳导演获奖", "5 分"],
            ["其他类别获奖", "每项 0.5 分，合计上限 2 分"],
          ],
        },
        {
          kind: "p",
          text: "电影节部分取九个奖项中的最高单项，不做累加，按 10 分满分折算。",
        },
        {
          kind: "table",
          head: ["奖项", "分值"],
          rows: [
            ["戛纳金棕榈 Palme d'Or", "10 分"],
            ["威尼斯金狮 Golden Lion", "9 分"],
            ["柏林金熊 Golden Bear", "8 分"],
            ["戛纳评审团大奖 Grand Prix", "6 分"],
            ["威尼斯评审团大奖 Grand Jury Prize", "5 分"],
            ["柏林银熊评审团大奖 Silver Bear Grand Jury", "5 分"],
            ["戛纳最佳导演 Best Director", "5 分"],
            ["戛纳评审团奖 Jury Prize", "4 分"],
            ["柏林银熊评审团奖 Silver Bear Jury（含 Alfred Bauer 奖）", "3 分"],
          ],
        },
        {
          kind: "p",
          text:
            "奖项广度奖励的是跨机构的覆盖范围，而不是奖项数量。四个机构各占 25 分，只看有没有获奖记录。",
        },
        {
          kind: "formula",
          text:
            "奖项广度 = 25 × 奥斯卡有获奖 + 25 × 戛纳有记录 + 25 × 威尼斯有记录 + 25 × 柏林有记录",
        },
        {
          kind: "p",
          text: "由于奖项统计过于耗时，很遗憾不能添加更多奖项。",
        },

        { kind: "h3", text: "维度 4 · 文化传播度（权重 25%）" },
        {
          kind: "p",
          text:
            "四个子项全部做对数归一化，因为这些数据跨越多个数量级（从几百到几百万）。每个子项只在有数据时才进入分母。",
        },
        {
          kind: "table",
          head: ["子项", "满分", "计算方式"],
          rows: [
            ["IMDb 投票数", "40 分", "clamp(40 × log10(1 + v) / log10(1 + 1,000,000), 0, 40)"],
            ["TMDB 投票数", "30 分", "clamp(30 × log10(v) / log10(15,000), 0, 30)"],
            ["票房收入", "15 分", "clamp(15 × log10(1 + revenue) / log10(1 + 1,000,000,000), 0, 15)"],
            ["TMDB popularity", "15 分", "clamp(15 × min(popularity / 100, 1), 0, 15)"],
          ],
        },
        {
          kind: "formula",
          text: "维度得分 = 100 × 已有子项得分之和 / 已有子项满分之和",
        },

        { kind: "h3", text: "Tier 映射" },
        {
          kind: "p",
          text:
            "单部分数与 Build 总分各自有一套档位线，因为两者分布宽度不同：单部分数由四个独立维度构成，在 200 部随机抽样里实测跨度约 0–77；Build 总分是五个已经取过平均的维度再加权平均，天然被压缩在约 38–72。用同一套阈值会让高段档位事实上不可达。两套线都是按实测分布定的。",
        },
        {
          kind: "table",
          head: ["单部分数区间", "Tier", "含义"],
          rows: [
            ["60 及以上", "S", "顶尖，几乎没有短板"],
            ["50 至 59", "A", "优秀，有少数弱点"],
            ["40 至 49", "B", "合格，有亮点也有硬伤"],
            ["28 至 39", "C", "明显弱点，认可集中在少数维度"],
            ["28 以下", "F", "认可度极低，或数据不足"],
          ],
        },
      ],
    },
    {
      id: "build",
      heading: "第二层 · Top 4 Build 评分（0-100）",
      blocks: [
        {
          kind: "formula",
          text:
            "Build 总分 = 0.25 × 质量 + 0.25 × 多样性 + 0.20 × 组合张力 + 0.15 × 辨识度 + 0.15 × 认可度平衡 + 规则调整（−10 ~ +5）",
        },
        {
          kind: "p",
          text:
            "五个维度各自先算到 0-100，再按权重加权求和，最后叠加规则加减分，结果夹到 [0, 100]。",
        },

        { kind: "h3", text: "维度 1 · Build 质量（权重 25%）" },
        {
          kind: "p",
          text:
            "四部电影单部分数的算术平均值。这个权重从概念上的 40% 下调到 25%，因为单部质量不应主导 Build 评价——Top 4 的核心是组合关系，不是四部电影各自有多好。",
        },

        { kind: "h3", text: "维度 2 · 多样性（权重 25%）" },
        {
          kind: "formula",
          text:
            "多样性 = 0.25 × 时代多样性 + 0.25 × 语言地区多样性 + 0.25 × 类型多样性 + 0.15 × 导演多样性 + 0.10 × 系列公司独立性",
        },
        {
          kind: "p",
          text:
            "时代多样性由香农熵与连续年份跨度两部分构成。7 个固定时代桶为：1930 年前、1930 至 50 年代、1960 至 70 年代、1980 至 90 年代、2000 年代、2010 年代、2020 年代。",
        },
        {
          kind: "formula",
          text:
            "p_k = 该时代的电影数 / 4\nH = −Σ(p_k × ln p_k)\nEraEntropy = 100 × H / ln 4\nSpan = min(1, (max(year) − min(year)) / 80)\n时代多样性 = 0.70 × EraEntropy + 0.30 × Span × 100",
        },
        {
          kind: "p",
          text:
            "语言地区多样性由语言熵与地区熵加权而成。地区按固定映射表归入十个宏观区域（北美、欧洲、东亚、南亚、东南亚、拉丁美洲、中东、大洋洲、非洲、其他）。合拍片最多贡献 2 个地区，否则一长串制作国家会凭空抬高地区多样性。",
        },
        {
          kind: "formula",
          text:
            "LanguageDiversity = 100 × H(language) / ln 4\nRegionDiversity = 100 × H(region) / ln 4\n语言地区多样性 = 0.55 × LanguageDiversity + 0.45 × RegionDiversity",
        },
        {
          kind: "p",
          text:
            "类型多样性取 TMDB 类型 ID 集合两两之间 Jaccard 距离的平均值，四部电影共 6 组配对。",
        },
        {
          kind: "formula",
          text:
            "JaccardDistance(i, j) = 1 − |Genres_i ∩ Genres_j| / |Genres_i ∪ Genres_j|\n类型多样性 = 100 × average(JaccardDistance(i, j), 全部 6 组)",
        },
        {
          kind: "p",
          text: "导演多样性只看不同导演的数量，四部片子由四位不同导演执导即为满分。",
        },
        {
          kind: "formula",
          text: "D = 不同导演数量\n导演多样性 = clamp(100 × (D − 1) / 3, 0, 100)",
        },
        {
          kind: "p",
          text: "系列公司独立性惩罚的是同系列扎堆与制作公司重复。",
        },
        {
          kind: "formula",
          text:
            "CollectionPenalty = 50   四部同属一个系列\nCollectionPenalty = 25   三部同属一个系列\nCompanyOverlap = 重复制作公司的比例\n系列公司独立性 = clamp(100 − CollectionPenalty − 25 × CompanyOverlap, 0, 100)",
        },

        { kind: "h3", text: "维度 3 · 组合张力（权重 20%）" },
        {
          kind: "formula",
          text:
            "综合亲和度 = 0.40 × 类型亲和 + 0.25 × 关键词亲和 + 0.20 × 创作者亲和 + 0.15 × 年代亲和",
        },
        {
          kind: "p",
          text:
            "类型亲和与关键词亲和都使用 Jaccard 相似度，分别作用于 TMDB 类型 ID 与关键词 ID，取全部 6 组配对的平均值。关键词只做集合运算，不解释语义。",
        },
        {
          kind: "formula",
          text: "类型亲和 = 100 × average(JaccardSimilarity(i, j), 全部 6 组)",
        },
        {
          kind: "p",
          text: "创作者亲和衡量导演与制作公司的重复程度。",
        },
        {
          kind: "formula",
          text:
            "DirectorRepeat = clamp((同一位导演最多执导数 − 1) / 3, 0, 1)\nSharedCompanyRate = 重复制作公司的比例\n创作者亲和 = 100 × (0.70 × DirectorRepeat + 0.30 × SharedCompanyRate)",
        },
        {
          kind: "p",
          text: "年代亲和使用年份差值计算：同一年为 1，相差 80 年及以上为 0。",
        },
        {
          kind: "formula",
          text:
            "YearSimilarity(i, j) = clamp(1 − |year_i − year_j| / 80, 0, 1)\n年代亲和 = 100 × average(YearSimilarity(i, j), 全部 6 组)",
        },
        {
          kind: "p",
          text:
            "四项加权平均后得到「综合亲和度」，衡量这四部电影彼此有多像。但组合张力并不是这条亲和度的单调函数——它是一条单峰曲线，峰值在亲和度 35 分的位置。",
        },
        {
          kind: "formula",
          text:
            "亲和度 ≤ 35: 组合张力 = 40 + 60 × 亲和度 / 35\n亲和度 > 35: 组合张力 = 100 − 55 × (亲和度 − 35) / 65",
        },
        {
          kind: "p",
          text:
            "两端的取值：四部电影毫无交集时（亲和度 0）得 40 分；四部电影几乎可以互相替换时（亲和度 100）得 45 分。只有落在峰值附近——既有说得清楚的共同线索，又保持真实的跨度——才拿满分。",
        },
        {
          kind: "p",
          text:
            "这样设计的原因：一个 Top 4 有两种失败方式。四部片毫无关系，它就是一个随机抽样；四部片是同一部片，它就是重复而不是表达。两种都不该被奖励。反过来，「反差」本身是加分项，不该被当成「不一致」扣分。峰值 35 分略高于实测的随机组合亲和度中位数（约 16 分），所以随手挑的四部不会掉进低分区，而刻意经营的一组可以明显甩开它。",
        },

        { kind: "h3", text: "维度 4 · 辨识度（权重 15%）" },
        {
          kind: "formula",
          text:
            "辨识度 = 0.35 × 类型集中度 + 0.30 × 导演签名 + 0.20 × 主流冷门混合 + 0.15 × 稀有特征",
        },
        {
          kind: "p",
          text:
            "类型集中度使用赫芬达尔指数（HHI）。集中度高说明风格专精，集中度低说明类型混搭，两者都可能构成辨识度，因此采用「偏离均匀分布的程度」来衡量，中间值最低。结果上限 80 分。",
        },
        {
          kind: "formula",
          text:
            "p_g = 类型 g 在四部电影中出现的比例\nHHI = Σ(p_g²)\n类型集中度 = min(80, 100 × 2 × |HHI − 0.25|)",
        },
        {
          kind: "p",
          text: "导演签名是一张固定分值表，按导演重复模式取值：",
        },
        {
          kind: "table",
          head: ["模式", "分值"],
          rows: [
            ["同一导演 2 部，且另外两部导演不同", "80"],
            ["同一导演 3 部", "70"],
            ["同一导演 4 部", "60"],
            ["导演不重复，但类型或关键词亲和达到 50 以上", "30"],
            ["导演与类型都高度随机", "20"],
          ],
        },
        {
          kind: "p",
          text:
            "主流冷门混合取电影层文化传播度得分的标准差：不同可见度的电影混在一起，通常比四部热度相当的作品更有组合特色。",
        },
        {
          kind: "formula",
          text:
            "FootprintSpread = stdDev(文化传播度_1..4)\n主流冷门混合 = clamp(100 × FootprintSpread / 40, 0, 100)",
        },
        {
          kind: "p",
          text: "稀有特征统计四个信号，每个信号只在该特征于四部中仅出现一次时才计分。",
        },
        {
          kind: "formula",
          text:
            "稀有特征 = 25 × 独特语言 + 25 × 独特地区 + 25 × 独特时代 + 25 × 独特类型",
        },

        { kind: "h3", text: "维度 5 · 认可度平衡（权重 15%）" },
        {
          kind: "formula",
          text:
            "认可度平衡 = 0.45 × 公众共识 + 0.30 × 奖项声望 + 0.15 × 文化可见度 + 0.10 × min(100, 认可层次 × 2)",
        },
        {
          kind: "p",
          text:
            "IMDb 声誉占最大比重（45%），因为它是可持续累积的公众评分；奖项占 30%，代表行业认可但不让它主导结果；文化可见度占 15%。最后 10% 奖励组合内部的认可度层次，用四部电影认可指数的标准差计算——四部完全同质时该项为 0。",
        },
        {
          kind: "p",
          text: "各项均值都只在有数据时参与计算，缺失项按比例重新分配权重。",
        },

        { kind: "h3", text: "Build 档位映射" },
        {
          kind: "p",
          text:
            "Build 总分是五个 0-100 维度的加权平均，天然被压缩：在 404 部 TMDB 热门与高分影片的池子里随机抽 2 万组四部，分位数是 25% = 51.9、50% = 55.2、75% = 58.1、90% = 60.4，跨度约 38–72。所以 Build 的档位线比单部分数低，是按这条实际分布划的，而不是照搬单部分的档位。",
        },
        {
          kind: "table",
          head: ["Build 总分区间", "Tier", "实测含义"],
          rows: [
            ["67 及以上", "S", "随机组合中约占 0.2%；四部都取自池内前 10% 影片时约 41% 达到"],
            ["58 至 66", "A", "随机组合中约占 26%"],
            ["53 至 57", "B", "随机组合中约占 42%"],
            ["46 至 52", "C", "随手挑四部的典型落点，约占 30%"],
            ["46 以下", "F", "需要四部都缺认可，或触发规则扣分"],
          ],
        },
        {
          kind: "p",
          text:
            "我们用 24 次不同起点的爬山搜索与 821 万组穷举交叉验证，404 部影片池中 Build 总分的全局最大值是 79.0，出自下面的组合。作为对照，随机抽 2 万组的实测最高分只有 72.2。",
        },
        {
          kind: "list",
          items: [
            "教父 The Godfather（1972）— 单片 76.1（S）",
            "教父2 The Godfather Part II（1974）— 单片 76.9（S）",
            "寄生虫 Parasite（2019）— 单片 88.7（S）",
            "四月三周两天 4 Months, 3 Weeks and 2 Days（2007）— 单片 53.6（A）",
          ],
        },
        {
          kind: "p",
          text: "这组的组合张力 99.3 几近顶格，并触发全部规则加分（+5）。",
        },
        {
          kind: "link",
          text: "在首页查看这组评分",
          href: "/?m=238,2009,240,496243",
        },

        { kind: "h3", text: "派别判定" },
        {
          kind: "p",
          text:
            "在五个维度之外，引擎会用同一组已经算出的信号做一次轻量的派别判定：命中的派别按「具体优先」排序，只展示最符合的那一个。排序大致是「结构 → 形态 → 构成 → 年代」：同系列、同导演、同类型这类结构性事实最优先，艺术电影派这类形态标签次之，跨语种、跨年代这些通常只是副产品，因此排在后面——年代类派别（老派电影派、年轻影迷派）排在最末，只有没有更具体的标签时才会显示。派别只是给信号组合起名字，不参与总分，也不影响档位与 Level。",
        },
        {
          kind: "table",
          head: ["派别", "判定信号"],
          rows: [
            ["全同系列派", "四部全部属于同一个电影系列"],
            ["导演专精派", "三部及以上出自同一位导演"],
            ["类型专精派", "类型集中度不低于 55"],
            ["艺术电影派", "组内平均榜单地位（TSPDT/《视与听》/《电影手册》）不低于 40，且平均热度（IMDb 与 TMDB 票数分之和）不超过 58"],
            ["国际电影猎人派", "非英语片不少于三部，且语种不少于两种"],
            ["混沌抽卡派", "多样性不低于 65，组合张力不超过 48，且导演签名为随机档"],
            ["终极混合派", "多样性不低于 70，组合张力不低于 55，主流混合不低于 60"],
            ["冷热混搭派", "主流混合不低于 60，且认可 spread 不低于 45"],
            ["颁奖季派", "奖项声望不低于 70，且不少于两部奥斯卡获奖片"],
            ["影迷标准答案派", "公众共识不低于 60，且组内平均榜单地位（TSPDT/《视与听》/《电影手册》）不低于 60"],
            ["电影发烧友派", "影评力不低于 60，两部同导演，且公众共识不超过 65"],
            ["大众真爱派", "公众共识不低于 70，影评力不超过 55，主流混合不超过 35，且没有任何一部片进入 TSPDT、《视与听》或《电影手册》榜单"],
            ["舒适电影派", "三部及以上属于舒适类型（喜剧、家庭、爱情、动画、音乐），且公众共识不低于 50"],
            ["冷门派", "每部片的 IMDb 与 TMDB 评分数都低于阈值"],
            ["老派电影派", "三部及以上来自 1970 年前的年代桶"],
            ["年轻影迷派", "三部及以上来自 2010s / 2020s"],
          ],
        },
        {
          kind: "p",
          text:
            "判定只看选片形态，不看动机。怀旧派、反主流派、反讽派这类取决于「为什么选它」的派别，数据看不见意图，因此不参与判定——这也是「评价选片套路，不评价人」的边界。",
        },
      ],
    },
    {
      id: "rules",
      heading: "规则加减分",
      blocks: [
        {
          kind: "p",
          text:
            "规则加减分只处理算法能够明确检测到的特殊情况，调整范围被夹在 −10 到 +5 之间。同一条件只会触发一次，不会重复累加。",
        },
        {
          kind: "table",
          head: ["规则", "分值", "触发条件"],
          rows: [
            ["三重覆盖", "+3", "3 个及以上时代，且 3 种及以上语言或地区，且 4 种及以上类型"],
            ["分布认可", "+2", "3 部及以上电影的单部分数达到 60"],
            ["全同系列", "−3", "四部全部属于同一个系列"],
            ["同质年代", "−2", "同一个时代，且同一种语言，且同主要地区"],
            ["类型狭窄", "−2", "总共不超过 2 种类型，且只有一种语言"],
            ["作弊", "−100", "提交的电影数量超过 4 部"],
          ],
        },
      ],
    },
    {
      id: "level",
      heading: "Level 系统（1-9）",
      blocks: [
        {
          kind: "p",
          text:
            "Level 描述的是公开数据呈现出的 Build 复杂度，不代表用户的智力、观影数量、职业或身份。",
        },
        {
          kind: "formula",
          text:
            "LevelRaw = 0.35 × 多样性 + 0.30 × 组合张力 + 0.20 × 辨识度 + 0.15 × 时代纵深\n\n时代纵深 = 0.60 × 时代多样性 + 0.40 × min(100, 奖项声望)",
        },
        {
          kind: "p",
          text:
            "LevelRaw 同样是多个已归一化维度的加权平均，实测跨度只有约 43–77（随机抽四部：10% = 55、50% = 61、90% = 66）。因此档位线比常见的百分制刻度窄得多——每级 4 分——否则所有组合都会挤在同一两级里。第 5 级的区间对准实测中位数。",
        },
        {
          kind: "table",
          head: ["LevelRaw", "Level", "描述"],
          rows: [
            ["46 及以下", "1", "白板开局"],
            ["47 至 50", "2", "起手套装"],
            ["51 至 54", "3", "类型尝鲜"],
            ["55 至 58", "4", "开荒期"],
            ["59 至 62", "5", "均衡构筑"],
            ["63 至 66", "6", "专精路线"],
            ["67 至 70", "7", "广度养成"],
            ["71 至 74", "8", "资深收藏"],
            ["75 及以上", "9", "满级构筑"],
          ],
        },
        {
          kind: "p",
          text:
            "LevelRaw 的全池上限同样实测过（同一套搜索与穷举流程）：81.3，Level 9，出自冬眠（2014）、远方（2002）、Oro negro（2024）与飞越疯人院（1975）——四个年代桶、三种语种、四个地区，组合张力 99.5、辨识度 76.5。注意其中一部单片只有 13.5 分（F）：LevelRaw 完全不看质量与认可度，冷门片的稀缺特征反而抬升辨识度，因此理论上限会被数据稀疏的影片推高。若只在前 120 部单片高分影片里穷举，上限是 80.0（黄金三镖客（1966）、霸王别姬（1993）、远方（2002）、冬眠（2014））。",
        },
        {
          kind: "link",
          text: "在首页查看这组评分",
          href: "/?m=265169,31026,1386238,510",
        },
      ],
    },
    {
      id: "attributes",
      heading: "属性面板",
      blocks: [
        {
          kind: "p",
          text:
            "属性面板只由上面已经算出的中间值组合而成，不会再次进入最终总分。它的作用是提供另一种读法，而不是另一个分数。",
        },
        {
          kind: "table",
          head: ["属性", "公式"],
          rows: [
            ["影评力 Film Criticism", "0.45 × 公众共识 + 0.35 × 奖项声望 + 0.20 × 时代纵深"],
            ["个性 Originality", "辨识度"],
            ["主流度 Mainstream Power", "文化可见度"],
            ["Build 张力", "组合张力"],
            ["时代纵深 Historical Depth", "时代纵深"],
            ["奖项声望 Awards Prestige", "奖项声望"],
            ["公众共识 Public Consensus", "公众共识"],
            [
              "被攻击风险 Roast Vulnerability",
              "clamp(100 − 0.45 × 多样性 − 0.35 × 组合张力 − 0.20 × 辨识度, 0, 100)",
            ],
          ],
        },
      ],
    },
    {
      id: "confidence",
      heading: "数据置信度",
      blocks: [
        {
          kind: "p",
          text: "单片数据置信度由五个可核实的字段累加而成，满分 100。",
        },
        {
          kind: "formula",
          text:
            "单片置信度 = 25 × 有 IMDb ID\n           + 25 × 有 IMDb 评分与票数\n           + 20 × 有类型与年份\n           + 15 × 有导演\n           + 15 × 奖项数据已核实",
        },
        {
          kind: "p",
          text: "整套 Build 的置信度是四部电影置信度的算术平均值。",
        },
        {
          kind: "table",
          head: ["分数", "等级", "处理方式"],
          rows: [
            ["85 至 100", "High", "字段完整，评级可直接采信"],
            ["65 至 84", "Medium", "正常评级，同时标记缺失字段"],
            ["40 至 64", "Low", "只输出区间，不建议作为最终 Tier"],
            ["0 至 39", "Invalid", "不评级，先修正影片匹配"],
          ],
        },
      ],
    },
    {
      id: "limits",
      heading: "方法论限制",
      blocks: [
        { kind: "h3", text: "算法可以稳定回答" },
        {
          kind: "list",
          items: [
            "四部电影在年代、语言、地区和类型上的差异有多大",
            "四部电影之间是否存在可计算的类型、关键词、导演或系列联动",
            "IMDb 声誉、奖项认可与文化可见度在组合内如何分布",
            "某个 Top 4 更接近专精流、混合流还是热门集中流",
          ],
        },
        { kind: "h3", text: "算法无法客观回答" },
        {
          kind: "list",
          items: [
            "你是否真的喜欢这四部电影",
            "你是否在刻意塑造某种形象",
            "哪一部电影「真正更伟大」",
            "四部的反差是否构成幽默",
            "你的年龄、职业、人格或任何现实身份",
          ],
        },
      ],
    },
  ],
};

const en: MethodDoc = {
  title: "Scoring algorithm",
  lead:
    "Every score on this site comes from public data and fixed formulas. No AI model is called, and no subjective judgement is applied. This page writes out both layers, every weight, every rule, and where the data comes from, so each step can be checked line by line.",
  toc: "On this page",
  back: "Back to scoring",
  sections: [
    {
      id: "overview",
      heading: "Overview",
      blocks: [
        {
          kind: "p",
          text:
            "Scoring happens in two layers. Layer one rates a single film from 0 to 100. Layer two rates the Top 4 build those films form, also from 0 to 100. The dependency runs one way only: per-film scores feed the build quality dimension, but the final build score never changes any individual film score.",
        },
        {
          kind: "p",
          text:
            "The split exists because “four good films” and “a good Top 4” are not the same thing. If the average were all that mattered, four universally acclaimed classics would always be the optimal answer and the relationships between them would be ignored entirely. In layer two the per-film quality weight is therefore held down to 25%, and the remaining 75% measures the relationships: how wide the span is, whether there is any computable overlap, and whether the selection shows a discernible overall tendency.",
        },
        {
          kind: "p",
          text:
            "The whole algorithm is deterministic. The same input always produces the same output. There is no randomness, no generative model, and no use of user profiles or behavioural data.",
        },
      ],
    },
    {
      id: "sources",
      heading: "Data sources and why they were chosen",
      blocks: [
        {
          kind: "p",
          text:
            "The algorithm draws on four kinds of external data. Each contributes only the fields it is best suited to, so that no single piece of information is counted twice.",
        },
        {
          kind: "table",
          head: ["Source", "Fields used", "Why"],
          rows: [
            [
              "TMDB",
              "vote_average, vote_count, popularity, genres, release_date, revenue, production_countries, production_companies, original_language, director, keywords, belongs_to_collection",
              "Audience rating and cultural footprint, plus the genres, regions, languages, directors and keywords the variety analysis needs",
            ],
            [
              "IMDb",
              "rating, vote_count",
              "The largest audience rating database for film, with far more votes than TMDB",
            ],
            [
              "Academy Awards",
              "Best Picture and Best Director wins, count of other category wins",
              "The most recognisable industry recognition signal",
            ],
            [
              "The big three festivals",
              "Palme d'Or, Golden Lion, Golden Bear, plus grand jury prizes, jury prizes and Best Director — nine award categories",
              "International recognition with unambiguous historical weight",
            ],
            [
              "TSPDT Top 1000",
              "rank",
              "The broadest historical-standing measure available",
            ],
            [
              "TSPDT 21st Century",
              "rank",
              "Covers films released in 2000 or later, compensating for contemporary films, which are structurally disadvantaged on an all-time list",
            ],
            [
              "Sight & Sound critics' poll",
              "rank",
              "One of the most authoritative all-time lists, representing a long-running critical consensus",
            ],
            [
              "Cahiers du Cinéma annual top 10",
              "rank",
              "A contemporary French auteurist critical view, far quicker to recognise new releases than an all-time list",
            ],
          ],
        },
        {
          kind: "p",
          text:
            "Two fields are deliberately unused: budget and runtime. Budget has no stable relationship with where a film sits in film history, and runtime has no explanatory power for taste. Including them would add noise without adding discrimination.",
        },
      ],
    },
    {
      id: "film",
      heading: "Layer 1 · Scoring a single film (0-100)",
      blocks: [
        {
          kind: "p",
          text:
            "A film score is the weighted sum of four dimensions. Each dimension is normalised to 0-100 first, then multiplied by its weight and summed, and the result is multiplied by 100.",
        },
        {
          kind: "formula",
          text:
            "Score = (audience × 0.20 + historical standing × 0.35 + awards × 0.20 + cultural footprint × 0.25) × 100",
        },
        { kind: "h3", text: "Dimension 1 · Audience rating (weight 20%)" },
        {
          kind: "p",
          text:
            "The primary source is the IMDb rating. Using a plain average has a well-known problem: a 9.2 from a few hundred voters is far less credible than an 8.8 from a hundred thousand. Bayesian shrinkage is applied first, pulling the rating toward the overall mean — the fewer the votes, the harder the pull.",
        },
        {
          kind: "formula",
          text:
            "WeightedRating = (v / (v + m)) × R + (m / (v + m)) × C\n\nR = IMDb rating\nv = IMDb vote count\nC = 6.8  reference mean\nm = 25000  credibility threshold",
        },
        {
          kind: "p",
          text:
            "The shrunk rating is then mapped onto 0-100. The mapping window is 5.0 to 9.0 rather than 0 to 10: real weighted ratings almost never fall below 5.0, so a full-range mapping would compress every film into the top band and destroy discrimination.",
        },
        {
          kind: "formula",
          text: "IMDbScore = clamp(100 × (WeightedRating − 5.0) / 4.0, 0, 100)",
        },
        {
          kind: "p",
          text:
            "Vote count also contributes to this dimension, but with a small weight only, because vote count is used again in the cultural footprint dimension. Giving it full weight here would count the same information twice.",
        },
        {
          kind: "formula",
          text:
            "VoteCredibility = clamp(100 × log10(1 + v) / log10(1 + 1,000,000), 0, 100)\nIMDbStrength = 0.85 × IMDbScore + 0.15 × VoteCredibility",
        },
        {
          kind: "p",
          text:
            "The TMDB rating is used as a cross-check. TMDB has a smaller sample than IMDb and skews more mainstream, so it takes only 30%, correcting for cases where the IMDb figure may be an outlier.",
        },
        {
          kind: "formula",
          text:
            "TMDBScore = clamp(tmdb_rating × 10, 0, 100)\nAudience = 0.70 × IMDbStrength + 0.30 × TMDBScore",
        },

        { kind: "h3", text: "Dimension 2 · Historical standing (weight 35%, the heaviest)" },
        {
          kind: "p",
          text:
            "This carries the largest weight because all-time lists aggregate the long-run consensus of thousands of critics and directors, unaffected by short-term hype or marketing. It sums four sub-items to a maximum of 28 points, which is then converted to a 0-100 scale.",
        },
        {
          kind: "table",
          head: ["Sub-item", "Points", "How it is computed"],
          rows: [
            ["TSPDT Top 1000", "13", "Rank 1 = 13 points, rank 1000 = 4.55, decay floored at 35%"],
            ["TSPDT 21st Century", "6", "Only for films released in 2000 or later; rank 1 = 6 points, rank 1000 = 2.1, decay floored at 35%"],
            ["Sight & Sound critics' poll", "4", "Rank 1 = 4 points, rank 250 = 1.4, decay floored at 35%"],
            ["Cahiers du Cinéma annual top 10", "5", "Rank 1 = 5 points, rank 10 = 1.75, decay floored at 35%"],
          ],
        },
        {
          kind: "p",
          text:
            "Every list shares one decay formula: rank 1 takes the full points for that sub-item and each further rank steps down by an equal amount, but the decay never reaches 0 — the tail of the list keeps 35% of the sub-item's points. The rank is clamped to [1, list length], so a rank beyond the end of the list is scored at the tail rather than producing a negative value.",
        },
        {
          kind: "formula",
          text:
            "RankPoints = maxPoints × (0.35 + 0.65 × (listLength − clamp(rank, 1, listLength)) / (listLength − 1))",
        },
        {
          kind: "p",
          text:
            "Why not decay to zero: on a thousand-long list, a plain linear falloff leaves everything past the first few hundred ranks at effectively nothing. Measured over a 200-film random sample, 44% of the dataset scored 0 on this dimension — the one carrying the largest weight — which flattened the middle of the distribution and left the total ranking driven by fame rather than by standing in film history. Holding a 35% floor keeps placement meaningful (rank 1 is still worth about 2.9x rank 1000 on the same list) while letting the tail contribute. “Listed, but last” still does not collapse onto “never listed”: only the latter scores exactly 0.",
        },
        {
          kind: "p",
          text:
            "These ranks are converted to a 0-100 scale and then weighted at 35%, but the denominator is not always the full 28 points: the TSPDT 21st Century list only covers films released in 2000 or later, so an earlier film could never appear on it and its absence there is UNKNOWN rather than NONE. Those 6 points then leave the denominator along with the sub-item, and the film is scored out of 22 instead. A 1963 classic is therefore not docked 6 points for failing to make a list it was never eligible for; conversely, a film released after 2000 that is genuinely absent from the list is a verified NONE — it scores 0 and the denominator stays at 28. The exemption requires confirmed ineligibility, so a film with an unknown release year does not qualify and keeps the full 28.",
        },
        {
          kind: "p",
          text:
            "TSPDT Top 1000 takes the heaviest 13 points because it is the broadest multi-source aggregate. The TSPDT 21st Century list compensates for contemporary films. The Sight & Sound critics' poll represents the long-run consensus of the critical establishment.",
        },
        {
          kind: "p",
          text:
            "The Cahiers du Cinéma top 10 supplies a contemporary French auteurist view, and its value lies in being timely: a film from last year is very unlikely to appear on TSPDT yet, but may already be on the Cahiers list. Together the four sub-items cover both long-run consensus and present-day judgement.",
        },

        { kind: "h3", text: "Dimension 3 · Awards (weight 20%)" },
        {
          kind: "formula",
          text: "Awards = 0.50 × Oscar + 0.35 × festivals + 0.15 × award breadth",
        },
        {
          kind: "p",
          text:
            "The Oscar part counts wins only and ignores nominations entirely. The three categories are summed and converted against a 15-point maximum. Awards follow the same rule as historical standing: a film the dataset does not carry scores 0 here rather than being treated as unknown.",
        },
        {
          kind: "table",
          head: ["Event", "Points"],
          rows: [
            ["Best Picture win", "8"],
            ["Best Director win", "5"],
            ["Other category wins", "0.5 each, capped at 2 in total"],
          ],
        },
        {
          kind: "p",
          text:
            "The festival part takes the single highest award of the nine rather than summing them, converted against a 10-point maximum.",
        },
        {
          kind: "table",
          head: ["Award", "Points"],
          rows: [
            ["Cannes Palme d'Or", "10"],
            ["Venice Golden Lion", "9"],
            ["Berlin Golden Bear", "8"],
            ["Cannes Grand Prix", "6"],
            ["Venice Grand Jury Prize", "5"],
            ["Berlin Silver Bear Grand Jury Prize", "5"],
            ["Cannes Best Director", "5"],
            ["Cannes Jury Prize", "4"],
            ["Berlin Silver Bear Jury Prize (incl. Alfred Bauer Prize)", "3"],
          ],
        },
        {
          kind: "p",
          text:
            "Award breadth rewards coverage across institutions, not the number of awards. Each of the four institutions is worth 25 points, counted purely on whether a win exists.",
        },
        {
          kind: "formula",
          text:
            "Breadth = 25 × Oscar win + 25 × Cannes record + 25 × Venice record + 25 × Berlin record",
        },
        {
          kind: "p",
          text:
            "As compiling award statistics is too time-consuming, regrettably we could not add more awards.",
        },

        { kind: "h3", text: "Dimension 4 · Cultural footprint (weight 25%)" },
        {
          kind: "p",
          text:
            "All four sub-items are log-normalised, because the underlying numbers span several orders of magnitude (from hundreds to millions). Each sub-item only enters the denominator when it has data.",
        },
        {
          kind: "table",
          head: ["Sub-item", "Points", "How it is computed"],
          rows: [
            ["IMDb votes", "40", "clamp(40 × log10(1 + v) / log10(1 + 1,000,000), 0, 40)"],
            ["TMDB votes", "30", "clamp(30 × log10(v) / log10(15,000), 0, 30)"],
            ["Box office revenue", "15", "clamp(15 × log10(1 + revenue) / log10(1 + 1,000,000,000), 0, 15)"],
            ["TMDB popularity", "15", "clamp(15 × min(popularity / 100, 1), 0, 15)"],
          ],
        },
        {
          kind: "formula",
          text: "Dimension score = 100 × sum of available points / sum of available maxima",
        },

        { kind: "h3", text: "Tier mapping" },
        {
          kind: "p",
          text:
            "Film scores and build totals get their own band edges, because the two are spread differently. A film score is built from four independent dimensions and spans roughly 0-77 over a 200-film random sample of the dataset; a build total is a weighted mean of five dimensions that have each already been averaged, so it is naturally compressed into about 38-72. A single shared table leaves the top bands unreachable. Both tables were fitted to the measured distributions.",
        },
        {
          kind: "table",
          head: ["Film score", "Tier", "Meaning"],
          rows: [
            ["60 and above", "S", "Top tier — virtually no weak spot"],
            ["50 to 59", "A", "Excellent, a few soft spots"],
            ["40 to 49", "B", "Solid, with clear highs and clear holes"],
            ["28 to 39", "C", "Obvious weaknesses, recognition in only a few places"],
            ["Below 28", "F", "Very little recognition, or insufficient data"],
          ],
        },
      ],
    },
    {
      id: "build",
      heading: "Layer 2 · Scoring the Top 4 build (0-100)",
      blocks: [
        {
          kind: "formula",
          text:
            "Build = 0.25 × quality + 0.25 × variety + 0.20 × build tension + 0.15 × identity + 0.15 × recognition balance + rule adjustments (−10 to +5)",
        },
        {
          kind: "p",
          text:
            "Each of the five dimensions is computed on 0-100 first, then combined by weight, and finally the rule adjustments are added. The result is clamped to [0, 100].",
        },

        { kind: "h3", text: "Dimension 1 · Build quality (weight 25%)" },
        {
          kind: "p",
          text:
            "The arithmetic mean of the four film scores. This weight was lowered from a conceptual 40% to 25% because per-film quality should not dominate the evaluation — the point of a Top 4 is the combination, not how good each film is on its own.",
        },

        { kind: "h3", text: "Dimension 2 · Variety (weight 25%)" },
        {
          kind: "formula",
          text:
            "Variety = 0.25 × era + 0.25 × language & region + 0.25 × genre + 0.15 × director + 0.10 × franchise & studio independence",
        },
        {
          kind: "p",
          text:
            "Era diversity combines Shannon entropy with a continuous year span. The seven fixed buckets are: pre-1930s, 1930s-50s, 1960s-70s, 1980s-90s, 2000s, 2010s, 2020s.",
        },
        {
          kind: "formula",
          text:
            "p_k = films in that era / 4\nH = −Σ(p_k × ln p_k)\nEraEntropy = 100 × H / ln 4\nSpan = min(1, (max(year) − min(year)) / 80)\nEra = 0.70 × EraEntropy + 0.30 × Span × 100",
        },
        {
          kind: "p",
          text:
            "Language and region diversity weights a language entropy term against a region entropy term. Regions are grouped by a fixed mapping into ten macro-regions (US & Canada, Europe, East Asia, South Asia, Southeast Asia, Latin America, Middle East, Oceania, Africa, Other). A co-production contributes at most two regions, otherwise a long production-country list would inflate regional diversity for free.",
        },
        {
          kind: "formula",
          text:
            "LanguageDiversity = 100 × H(language) / ln 4\nRegionDiversity = 100 × H(region) / ln 4\nLanguage & region = 0.55 × LanguageDiversity + 0.45 × RegionDiversity",
        },
        {
          kind: "p",
          text:
            "Genre diversity averages the Jaccard distance between every pair of TMDB genre-id sets — six pairs in total for four films.",
        },
        {
          kind: "formula",
          text:
            "JaccardDistance(i, j) = 1 − |Genres_i ∩ Genres_j| / |Genres_i ∪ Genres_j|\nGenre = 100 × average(JaccardDistance(i, j), all 6 pairs)",
        },
        {
          kind: "p",
          text:
            "Director diversity looks only at the number of distinct directors; four films by four different directors reach full marks.",
        },
        {
          kind: "formula",
          text: "D = distinct directors\nDirector = clamp(100 × (D − 1) / 3, 0, 100)",
        },
        {
          kind: "p",
          text:
            "Franchise and studio independence penalises clustering inside one collection and repeated production companies.",
        },
        {
          kind: "formula",
          text:
            "CollectionPenalty = 50   all four in one collection\nCollectionPenalty = 25   three in one collection\nCompanyOverlap = share of duplicated company credits\nIndependence = clamp(100 − CollectionPenalty − 25 × CompanyOverlap, 0, 100)",
        },

        { kind: "h3", text: "Dimension 3 · Build tension (weight 20%)" },
        {
          kind: "formula",
          text:
            "Blended affinity = 0.40 × genre affinity + 0.25 × keyword affinity + 0.20 × creator affinity + 0.15 × era affinity",
        },
        {
          kind: "p",
          text:
            "Genre affinity and keyword affinity both use Jaccard similarity, applied to TMDB genre ids and keyword ids respectively, averaged over all six pairs. Keywords are treated purely as a set; no semantics are interpreted.",
        },
        {
          kind: "formula",
          text: "Genre affinity = 100 × average(JaccardSimilarity(i, j), all 6 pairs)",
        },
        {
          kind: "p",
          text:
            "Creator affinity measures repetition among directors and production companies.",
        },
        {
          kind: "formula",
          text:
            "DirectorRepeat = clamp((max films by one director − 1) / 3, 0, 1)\nSharedCompanyRate = share of duplicated company credits\nCreator affinity = 100 × (0.70 × DirectorRepeat + 0.30 × SharedCompanyRate)",
        },
        {
          kind: "p",
          text:
            "Era affinity uses the difference in release years: the same year scores 1, a gap of 80 years or more scores 0.",
        },
        {
          kind: "formula",
          text:
            "YearSimilarity(i, j) = clamp(1 − |year_i − year_j| / 80, 0, 1)\nEra affinity = 100 × average(YearSimilarity(i, j), all 6 pairs)",
        },
        {
          kind: "p",
          text:
            "The weighted mean of those four is the blended affinity — how much the four films resemble each other. Build tension is not a monotone function of it: the curve is single-peaked, topping out at an affinity of 35.",
        },
        {
          kind: "formula",
          text:
            "Affinity ≤ 35: tension = 40 + 60 × affinity / 35\nAffinity > 35: tension = 100 − 55 × (affinity − 35) / 65",
        },
        {
          kind: "p",
          text:
            "At the ends: four films with nothing in common (affinity 0) score 40, and four films that could stand in for each other (affinity 100) score 45. Only the band around the peak — a common thread you can actually name, with real range left in it — reaches full marks.",
        },
        {
          kind: "p",
          text:
            "The reason for the shape: a Top 4 can fail in two directions. Four unrelated films are a random draw; four interchangeable films are a repetition rather than a statement. Neither deserves a reward. Contrast, on the other hand, is a virtue and should not be docked for being “inconsistent”. The peak at 35 sits just above the measured median affinity of a random quartet (about 16), so an offhand pick still scores respectably while a deliberate one can clearly pull ahead.",
        },

        { kind: "h3", text: "Dimension 4 · Identity (weight 15%)" },
        {
          kind: "formula",
          text:
            "Identity = 0.35 × genre concentration + 0.30 × director signature + 0.20 × mainstream mix + 0.15 × rare traits",
        },
        {
          kind: "p",
          text:
            "Genre concentration uses the Herfindahl index. High concentration means a narrow specialism, low concentration means a genre mash-up; both can constitute identity, so the measure is the distance from an even spread, which makes the middle the lowest score. The result is capped at 80.",
        },
        {
          kind: "formula",
          text:
            "p_g = share of genre g across the four films\nHHI = Σ(p_g²)\nGenre concentration = min(80, 100 × 2 × |HHI − 0.25|)",
        },
        {
          kind: "p",
          text:
            "Director signature is a fixed score table keyed on the director repetition pattern:",
        },
        {
          kind: "table",
          head: ["Pattern", "Score"],
          rows: [
            ["One director twice, with two different directors alongside", "80"],
            ["One director three times", "70"],
            ["One director four times", "60"],
            ["No repeated director, but genre or keyword affinity of 50 or more", "30"],
            ["Directors and genres both effectively random", "20"],
          ],
        },
        {
          kind: "p",
          text:
            "Mainstream mix takes the standard deviation of the per-film cultural-footprint scores: mixing films of very different visibility usually reads as a more distinctive build than four films of comparable reach.",
        },
        {
          kind: "formula",
          text:
            "FootprintSpread = stdDev(cultural footprint of the 4 films)\nMainstream mix = clamp(100 × FootprintSpread / 40, 0, 100)",
        },
        {
          kind: "p",
          text:
            "Rare traits counts four signals; each one scores only when that trait appears in exactly one of the four films.",
        },
        {
          kind: "formula",
          text: "Rare traits = 25 × unique language + 25 × unique region + 25 × unique era + 25 × unique genre",
        },

        { kind: "h3", text: "Dimension 5 · Recognition balance (weight 15%)" },
        {
          kind: "formula",
          text:
            "Recognition = 0.45 × public consensus + 0.30 × awards prestige + 0.15 × cultural visibility + 0.10 × min(100, recognition spread × 2)",
        },
        {
          kind: "p",
          text:
            "IMDb reputation takes the largest share (45%) because it is a durably accumulated public rating; awards take 30%, representing industry recognition without letting prizes dominate; cultural visibility takes 15%. The final 10% rewards internal layering of recognition, computed from the standard deviation of the four films' recognition index — for four fully homogeneous films this term is 0.",
        },
        {
          kind: "p",
          text:
            "Every mean only includes films that have the relevant data; missing entries have their weight redistributed proportionally.",
        },

        { kind: "h3", text: "Build tier mapping" },
        {
          kind: "p",
          text:
            "A build total is a weighted mean of five 0-100 dimensions, so it is inherently compressed: sampling 20k random quartets from a 404-film pool of TMDB popular and top-rated titles gives p25 = 51.9, p50 = 55.2, p75 = 58.1, p90 = 60.4, spanning about 38-72. The build bands therefore sit lower than the film bands. They are drawn from that measured distribution rather than copied from the film table.",
        },
        {
          kind: "table",
          head: ["Build total", "Tier", "Measured meaning"],
          rows: [
            ["67 and above", "S", "0.2% of random quartets; 41% when all four films come from the top decile"],
            ["58 to 66", "A", "About 26% of random quartets"],
            ["53 to 57", "B", "About 42% of random quartets"],
            ["46 to 52", "C", "Where an offhand quartet typically lands, about 30%"],
            ["Below 46", "F", "Requires four films lacking recognition, or a rule penalty"],
          ],
        },
        {
          kind: "p",
          text:
            "Hill-climbing from 24 different random starts, cross-checked against an exhaustive pass of 8.2 million quartets, puts the global maximum of the build total over the 404-film pool at 79.0, achieved by the quartet below. For comparison, the best of 20k random quartets is only 72.2.",
        },
        {
          kind: "list",
          items: [
            "The Godfather (1972) — film score 76.1 (S)",
            "The Godfather Part II (1974) — film score 76.9 (S)",
            "Parasite (2019) — film score 88.7 (S)",
            "4 Months, 3 Weeks and 2 Days (2007) — film score 53.6 (A)",
          ],
        },
        {
          kind: "p",
          text:
            "This quartet scores 99.3 on tension, close to the cap, and triggers every rule bonus (+5).",
        },
        {
          kind: "link",
          text: "Open this build in the scorer",
          href: "/?m=238,2009,240,496243",
        },

        { kind: "h3", text: "School detection" },
        {
          kind: "p",
          text:
            "Beyond the five dimensions, the engine runs a lightweight school detection over the same signals it has already computed: matches are ranked most-specific first, and only the top one is shown. The ranking runs roughly from structure to style to composition to era — structural facts (same collection, same director, one genre) come first, style labels such as The Art-House next, while crossing languages or decades is usually a side effect and therefore ranks lower. The era schools (The Old School, The Young Cinephile) sit last and only surface when nothing more specific applies. A school is only a name for a combination of signals — it never feeds into the total, the tier, or the Level.",
        },
        {
          kind: "table",
          head: ["School", "Detection signal"],
          rows: [
            ["The Franchise Lock", "All four films belong to the same collection"],
            ["The Auteur Specialist", "Three or more films by the same director"],
            ["The Genre Specialist", "Genre concentration of 55 or above"],
            ["The Art-House", "Mean critics'-list standing (TSPDT / Sight & Sound / Cahiers) ≥ 40, and mean heat (IMDb + TMDB vote points) ≤ 58"],
            ["The International Hunter", "At least three non-English films across at least two languages"],
            ["The Chaos Draw", "Variety ≥ 65, coherence ≤ 48, and a random-tier director signature"],
            ["The Ultimate Mixer", "Variety ≥ 70, coherence ≥ 55, and mainstream mix ≥ 60"],
            ["The Hot-Cold Mixer", "Mainstream mix ≥ 60 and recognition spread ≥ 45"],
            ["The Awards Season", "Awards prestige ≥ 70 and at least two Oscar-winning films"],
            ["The Cinephile Correct Answers", "Public consensus ≥ 60 and mean critics'-list standing (TSPDT / Sight & Sound / Cahiers) ≥ 60"],
            ["The Cinephile", "Film criticism ≥ 60, two films by one director, and public consensus ≤ 65"],
            ["The Crowd Pleaser", "Public consensus ≥ 70, film criticism ≤ 55, mainstream mix ≤ 35, and no film on the TSPDT, Sight & Sound, or Cahiers lists"],
            ["The Comfort Viewer", "Three or more comfort genres (comedy, family, romance, animation, music) and public consensus ≥ 50"],
            ["The Deep Cut", "Every film's IMDb and TMDB vote counts below threshold"],
            ["The Old School", "Three or more films from pre-1970 era buckets"],
            ["The Young Cinephile", "Three or more films from the 2010s / 2020s"],
          ],
        },
        {
          kind: "p",
          text:
            "Detection reads only the shape of the build, never the motive. Schools that depend on why the films were picked — nostalgia, contrarianism, irony — are invisible to the data and therefore not detected at all. That is the same line as scoring the build, not the person.",
        },
      ],
    },
    {
      id: "rules",
      heading: "Rule adjustments",
      blocks: [
        {
          kind: "p",
          text:
            "Rule adjustments handle only the special cases the algorithm can detect explicitly. The total is clamped between −10 and +5, and each condition can trigger at most once, so nothing is double-counted.",
        },
        {
          kind: "table",
          head: ["Rule", "Delta", "Condition"],
          rows: [
            ["Triple coverage", "+3", "3 or more eras, and 3 or more languages or regions, and 4 or more genres"],
            ["Distributed recognition", "+2", "3 or more films score 60 or above"],
            ["Same collection", "−3", "All four films belong to the same collection"],
            ["Homogeneous era", "−2", "One era, one language, and one primary region"],
            ["Narrow genre", "−2", "At most 2 genres in total, and a single language"],
            ["Cheat", "−100", "More than four films submitted"],
          ],
        },
      ],
    },
    {
      id: "level",
      heading: "Level system (1-9)",
      blocks: [
        {
          kind: "p",
          text:
            "Level describes the complexity the public data shows in a build. It says nothing about the user's intelligence, how many films they have seen, their job or their identity.",
        },
        {
          kind: "formula",
          text:
            "LevelRaw = 0.35 × variety + 0.30 × tension + 0.20 × identity + 0.15 × historical depth\n\nHistoricalDepth = 0.60 × era diversity + 0.40 × min(100, awards prestige)",
        },
        {
          kind: "p",
          text:
            "LevelRaw is likewise a weighted mean of already-normalised dimensions, and spans only about 43-77 in practice (random quartets: p10 = 55, p50 = 61, p90 = 66). The bands are therefore far narrower than a percentage scale would suggest — 4 points each — or every build would sit in the same one or two levels. Level 5 is anchored on the measured median.",
        },
        {
          kind: "table",
          head: ["LevelRaw", "Level", "Label"],
          rows: [
            ["46 and below", "1", "Blank Slate"],
            ["47 to 50", "2", "Opening Hand"],
            ["51 to 54", "3", "Genre Curious"],
            ["55 to 58", "4", "Exploration Phase"],
            ["59 to 62", "5", "Balanced Build"],
            ["63 to 66", "6", "Specialized"],
            ["67 to 70", "7", "Wide Range"],
            ["71 to 74", "8", "Seasoned Collector"],
            ["75 and above", "9", "Maxed Build"],
          ],
        },
        {
          kind: "p",
          text:
            "The pool-wide ceiling of LevelRaw has been measured with the same search and exhaustive passes: 81.3, Level 9, from Winter Sleep (2014), Distant (2002), Oro negro (2024) and One Flew Over the Cuckoo's Nest (1975) — four era buckets, three languages, four regions, tension 99.5 and identity 76.5. Note that one film scores only 13.5 (F): LevelRaw ignores quality and recognition entirely, and the scarcity signatures of obscure titles raise identity instead, so the theoretical ceiling is pushed up by data-thin films. Restricted to the top 120 films by individual score, the exhaustive maximum is 80.0 (The Good, the Bad and the Ugly (1966), Farewell My Concubine (1993), Distant (2002), Winter Sleep (2014)).",
        },
        {
          kind: "link",
          text: "Open this build in the scorer",
          href: "/?m=265169,31026,1386238,510",
        },
      ],
    },
    {
      id: "attributes",
      heading: "Attribute panel",
      blocks: [
        {
          kind: "p",
          text:
            "The attribute panel is assembled only from intermediate values already computed above. Nothing here feeds back into the final score — its purpose is to offer a second reading, not a second grade.",
        },
        {
          kind: "table",
          head: ["Attribute", "Formula"],
          rows: [
            ["Film criticism", "0.45 × public consensus + 0.35 × awards prestige + 0.20 × historical depth"],
            ["Originality", "identity"],
            ["Mainstream power", "cultural visibility"],
            ["Build tension", "tension"],
            ["Historical depth", "historical depth"],
            ["Awards prestige", "awards prestige"],
            ["Public consensus", "public consensus"],
            [
              "Roast vulnerability",
              "clamp(100 − 0.45 × variety − 0.35 × tension − 0.20 × identity, 0, 100)",
            ],
          ],
        },
      ],
    },
    {
      id: "confidence",
      heading: "Data confidence",
      blocks: [
        {
          kind: "p",
          text:
            "Per-film data confidence is the sum of five verifiable fields, out of 100.",
        },
        {
          kind: "formula",
          text:
            "FilmConfidence = 25 × has IMDb id\n               + 25 × has IMDb rating and votes\n               + 20 × has genres and year\n               + 15 × has director\n               + 15 × awards data verified",
        },
        {
          kind: "p",
          text:
            "The confidence of a whole build is the arithmetic mean of the four film confidences.",
        },
        {
          kind: "table",
          head: ["Score", "Band", "How it is handled"],
          rows: [
            ["85 to 100", "High", "Fields complete; the rating can be taken at face value"],
            ["65 to 84", "Medium", "Rated normally, with missing fields flagged"],
            ["40 to 64", "Low", "Range only; a final tier is not advisable"],
            ["0 to 39", "Invalid", "Not rated; fix the film match first"],
          ],
        },
      ],
    },
    {
      id: "limits",
      heading: "Methodological limits",
      blocks: [
        { kind: "h3", text: "What the algorithm answers reliably" },
        {
          kind: "list",
          items: [
            "How far apart the four films are in era, language, region and genre",
            "Whether there is a computable genre, keyword, director or franchise connection between them",
            "How IMDb reputation, awards recognition and cultural visibility are distributed inside the build",
            "Whether a given Top 4 reads closer to a specialist build, a mixed build or a mainstream cluster",
          ],
        },
        { kind: "h3", text: "What it cannot answer objectively" },
        {
          kind: "list",
          items: [
            "Whether you actually like these four films",
            "Whether you are deliberately cultivating an image",
            "Which film is genuinely greater",
            "Whether the contrast between the four is funny",
            "Your age, job, personality or any real-world identity",
          ],
        },
      ],
    },
  ],
};

export const METHOD_DOC: Record<Lang, MethodDoc> = { zh, en };
