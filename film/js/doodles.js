// FilmDoodle — 塗鴉框
// 一鍵在照片邊緣撒上手繪塗鴉，中間留給主角。
// 風格包（pack）決定「用哪些塗鴉、什麼顏色」，排列（layout）決定「放在哪裡」，
// 數量（count）就是實際要放幾個。產生的塗鴉跟一般貼圖同格式，可以「轉成貼圖」再個別調整。

import { rng } from './film.js';
import { STICKERS, stickerBox, isRecolorable } from './stickers.js';
import { PACKS_V9, PRESETS_V9 } from './art/v9.js';

// 排列：回傳 0~1，越大越適合放塗鴉。sx/sy = 寬/高 除以短邊（短邊 = 1）
export const LAYOUTS = [
  ['edge', '四周'], ['band', '上下'], ['sides', '左右'], ['corner', '四角'], ['top', '天空'],
];
const smooth = (a, b, v) => (v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a));
const LAYOUT_FN = {
  edge: (x, y, sx, sy) => 1 - smooth(0.12, 0.22, Math.min(Math.min(x, 1 - x) * sx, Math.min(y, 1 - y) * sy)),
  band: (x, y, sx, sy) => 1 - smooth(0.14, 0.24, Math.min(y, 1 - y) * sy),
  sides: (x, y, sx, sy) => Math.max(1 - smooth(0.15, 0.26, Math.min(x, 1 - x) * sx), 0.35 * (1 - smooth(0.08, 0.14, y * sy))),
  corner: (x, y, sx, sy) => {
    let m = 0;
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) m = Math.max(m, 1 - smooth(0.24, 0.4, Math.hypot((x - cx) * sx, (y - cy) * sy)));
    return m;
  },
  top: (x, y, sx, sy) => Math.max(1 - smooth(0.2, 0.32, y * sy), 0.3 * smooth(0.88, 0.94, y)),
};

// 第九版：大中小的差距縮小（參考圖 28：圖案大小差不多、平均散開），最小的也要一眼看得出是什麼
const SIZES = { small: [0.075, 0.095], medium: [0.105, 0.135], large: [0.155, 0.2] };

// 風格包：每一包參考一種使用者提供的範例「風格」，圖案全部是原創
export const PACKS = {
  // 第六版：A 色鉛筆小物（參考圖 14 的彩鉛顆粒；保持原本配色，不換色）
  pencil: {
    name: '色鉛筆小物', glow: 0, noGlow: true, lw: 0.0034,
    sizes: { small: [0.075, 0.095], medium: [0.105, 0.135], large: [0.16, 0.2] },
    small: { pc_star8: 2, pc_button: 1, pc_cherry: 1.2, pc_flower: 1.5, pc_moon: 0.6, pc_heart: 1, pc_lemon: 0.8, pc_strawberry: 1, pc_apple: 0.8, pc_cloud: 0.8, pc_letter: 0.6, pc_orange: 0.8, pc_cookie: 0.8 },
    medium: { pc_cherry: 1, pc_bow: 1, pc_flower: 1, pc_cutlery: 0.8, pc_teacup: 1, pc_bread: 0.8, pc_mitten: 0.8, pc_star8: 1, pc_moon: 0.8,
      pc_apple: 1, pc_pear: 1, pc_lemon: 1, pc_mushroom: 1, pc_sock: 0.8, pc_heart: 0.8, pc_cloud: 1, pc_jar: 0.8, pc_candle: 0.8, pc_tulip: 1, pc_strawberry: 1, pc_letter: 0.8,
      pc_beanie: 1, pc_orange: 1, pc_cookie: 1, pc_vase: 1, pc_scarf: 1 },
    large: { pc_sweater: 1, pc_teacup: 1, pc_cake: 1, pc_bow: 0.8, pc_teapot: 1, pc_jar: 0.8, pc_mushroom: 0.8, pc_tulip: 0.8, pc_vase: 0.8, pc_scarf: 0.8, pc_beanie: 0.6 },
    max: { pc_sweater: 1, pc_cake: 1, pc_cutlery: 1, pc_teapot: 1, pc_jar: 1, pc_candle: 1, pc_sock: 1 },
  },
  // 第六版：B 植物版畫（參考圖 13 的印壓顆粒、挖空）
  print: {
    name: '植物版畫', glow: 0, noGlow: true, lw: 0.0034,
    sizes: { small: [0.1, 0.12], medium: [0.13, 0.17], large: [0.2, 0.25] },
    colors: ['#9dc044', '#8fb0c9', '#cb8875', '#a99bc5'], recolor: 0.25,
    small: { pr_clover: 1.5, pr_daisy: 1, pr_oak: 1, pr_ginkgo: 1, pr_maple: 1, pr_mushroom: 0.8, pr_acorn: 0.8, pr_eucalyptus: 0.8, pr_leaf: 0.8, pr_grass: 0.8, pr_pinecone: 0.8, pr_rosemary: 0.8 },
    medium: { pr_wheat: 1, pr_daisy: 1, pr_clover: 1, pr_olive: 1, pr_dandelion: 1, pr_oak: 0.8,
      pr_tulip: 1, pr_lavender: 1, pr_ginkgo: 0.8, pr_maple: 0.8, pr_cosmos: 1, pr_thistle: 1, pr_eucalyptus: 1, pr_berry: 1, pr_mushroom: 0.8, pr_poppy: 1, pr_allium: 1, pr_cattail: 1, pr_grass: 0.8,
      pr_palm: 1, pr_pinecone: 1, pr_iris: 1, pr_hydrangea: 1, pr_rosemary: 1 },
    large: { pr_fern: 1, pr_pine: 1, pr_wheat: 1, pr_olive: 1, pr_monstera: 1, pr_sunflower: 1, pr_leaf: 1, pr_tulip: 0.8, pr_cattail: 0.8, pr_berry: 0.8, pr_palm: 1, pr_hydrangea: 0.8, pr_iris: 0.8 },
  },
  // 奶油貼紙（第八版）：象牙紙底＋玫瑰色細線的色鉛筆貼紙；'M' 換成色票的低飽和色
  cream: {
    name: '奶油貼紙', glow: 0, noGlow: true, lw: 0.0034,
    sizes: { small: [0.07, 0.09], medium: [0.1, 0.13], large: [0.15, 0.19] },
    colors: ['#D69C98', '#CB8875', '#A99BC5', '#9CB9D0', '#A6B58A', '#E3C77E'], recolor: 0.35,
    small: { cr_dotheart: 1.2, cr_sparkle: 1.2, cr_cross: 1, cr_flower4: 1.2, cr_candy: 0.8, cr_twinstar: 1, cr_button: 1, cr_drop: 1, cr_star5: 1, cr_clover: 0.8, cr_cutheart: 0.8 },
    medium: {
      cr_heart: 1, cr_flower5: 1, cr_bigstar: 1, cr_swirl: 0.6, cr_bow: 1, cr_butterfly: 1, cr_moon: 1, cr_cloud: 1, cr_cherry: 1,
      cr_strawberry: 1, cr_tulip: 1, cr_leaf: 1, cr_envelope: 0.8, cr_mushroom: 1, cr_shell: 1, cr_sun: 0.8, cr_lemon: 1, cr_teacup: 1, cr_planet: 1,
    },
    large: { cr_bigstar: 1, cr_heart: 1, cr_flower5: 1, cr_moon: 1, cr_cloud: 1, cr_strawberry: 1, cr_bow: 1, cr_butterfly: 1, cr_teacup: 0.8, cr_planet: 0.8 },
  },
  // 花花世界（第八版）：版畫色塊，配色換成色票
  flora: {
    name: '花花世界', glow: 0, noGlow: true, lw: 0.0034, largeExtra: 1, bleed: 0.3,
    sizes: { small: [0.08, 0.1], medium: [0.11, 0.15], large: [0.18, 0.23] },
    colors: ['#CB8875', '#D69C98', '#9CB9D0', '#A99BC5', '#E9D79A'], recolor: 0.25,
    keepColor: ['fl_ginkgo', 'fl_monstera', 'fl_eucalyptus', 'fl_grass', 'fl_sprig', 'fl_fern'],
    small: { fl_star: 1.2, fl_blue: 1.2, kt_blossom2: 1, fl_round: 1, fl_anemone: 1, fl_chamomile: 0.8, fl_hydrangea: 0.8, fl_poppy: 0.8, fl_cornflower: 0.8, fl_clematis: 0.8 },
    medium: {
      fl_daisy: 1, fl_cosmos: 1, fl_round: 0.8, fl_tulip: 1, fl_ginkgo: 1, fl_poppy: 1, fl_anemone: 1, fl_hydrangea: 1, fl_sunflower: 1,
      fl_rosebud: 1, fl_chamomile: 1, fl_lupine: 1, fl_berries: 1, fl_monstera: 0.8,
      fl_cornflower: 1, fl_peony: 1, fl_magnolia: 1, fl_clematis: 1, fl_daffodil: 1,
    },
    large: { fl_sprig: 1, fl_bunch: 1, fl_fern: 0.8, fl_starbranch: 1, fl_eucalyptus: 1, fl_lavender: 1, fl_mimosa: 1, fl_monstera: 1, fl_grass: 0.8, fl_lupine: 0.8, fl_berries: 0.8, fl_peony: 0.8, fl_magnolia: 0.8 },
  },
  // 夢幻粉彩（第八版）：淡粉彩的色鉛筆細線
  pastel: {
    name: '夢幻粉彩', glow: 0, noGlow: true, lw: 0.0032,
    sizes: { small: [0.07, 0.09], medium: [0.1, 0.13], large: [0.17, 0.22] },
    colors: ['#F4EEDF', '#E7B7C0', '#B9CFE0', '#A99BC5', '#EADFA8', '#BFD3B4'], recolor: 0.4,
    small: { pl_twinkle: 1.6, pl_star: 1, pl_daisy: 0.8, pl_dotarc: 0.8, pl_crosses: 1.2, pl_bubbles: 1, pl_heart: 1, pl_moon: 0.8, pl_twostar: 0.8, pl_clover: 0.8 },
    medium: {
      pl_flower: 1, pl_daisy: 1, pl_streak: 1, pl_dotarc: 0.8, pl_cloud: 1, pl_ribbon: 1, pl_tulip: 1, pl_sprig: 1, pl_rainbow: 1,
      pl_swirl: 0.8, pl_butterfly: 1, pl_balloon: 1, pl_saturn: 1, pl_wave: 0.8, pl_bow: 1, pl_moon: 1,
      pl_twostar: 1, pl_shell: 1, pl_teacup: 1, pl_clover: 1,
    },
    large: { pl_catjump: 1, pl_gradcat: 0.8, pl_catsit: 1, pl_stripecat: 1, nc_cathead: 0.6, pl_flower: 1, pl_rainbow: 0.8, pl_cloud: 0.8, pl_balloon: 0.8 },
    max: { pl_catjump: 1, pl_gradcat: 1, pl_catsit: 1, pl_stripecat: 1, nc_cathead: 1 },
  },
  // 螢光塗鴉（第八版）：蠟筆粉筆般的亮色線條；有臉的舊圖不放
  neon: {
    // 第九版：恢復霓虹外光（蠟筆筆觸＋外發光）；光暈滑桿可以調
    name: '螢光塗鴉', glow: 0.75, lw: 0.0045,
    colors: ['#F2A7C3', '#EE8C86', '#F2AE6E', '#F1D06A', '#A3D49B', '#8FCFE0', '#8DA6E6', '#BFA4E8', '#ffffff'], recolor: 0.55,
    small: { sparkle: 1.6, sparkles: 1, fstar: 1.2, ring: 1, wave: 1.2, zigzag: 1.2, cross: 1, lines: 0.5, hearto: 1.2, dots: 0.6, note: 0.8 },
    medium: {
      sunny: 1, burst: 1, camera: 1, film: 1, crown: 0.6, rainbow: 0.8, pennant: 0.5, stripes: 0.4, nc_scratch: 0.6,
      swirl: 0.8, arrow: 0.8, bolt: 1, note: 0.8, plane: 1, cherry: 1, palm: 0.8, loop: 0.6, hearts: 0.8, bow: 0.8,
      clover: 1, heartline: 1, exclaim: 0.6, underline: 0.5,
    },
    large: { camera: 1, rainbow: 1, palm: 1, plane: 1, sunny: 0.8, crown: 0.6, bolt: 0.6 },
  },
  // 蠟筆天空（第八版）：月亮、雲、星星、氣球、飛行的東西，排在照片上方
  crayon: {
    name: '蠟筆天空', glow: 0, noGlow: true, // 蠟筆筆刷不畫光暈，所以不顯示光暈滑桿
    sizes: { small: [0.08, 0.1], medium: [0.11, 0.145], large: [0.17, 0.22] },
    colors: ['#fff3df', '#ffe38a', '#ffb98a', '#ff9fc1', '#8fe0e0', '#c9b8f0'], recolor: 0.3,
    small: { cr2_stars: 1.6, cr2_birds: 1.2, cr3_sparkles: 1.4, cr3_constellation: 1, cr3_snowflake: 0.8, cr3_moon: 0.8, cr3_bigstar: 0.8, cr4_burst: 1, cr4_rain: 0.8, cr4_bubbles: 0.8 },
    medium: {
      cr2_firework: 1, cr2_teru: 0.8, cr2_planet: 1, cr2_shoot: 1.2, cr2_cloud: 1.2, cr3_moon: 1, cr3_sun: 1, cr3_kite: 1, cr3_plane: 1,
      cr3_rocket: 1, cr3_raincloud: 1, cr3_bigstar: 1, cr3_pinwheel: 0.8, cr3_umbrella: 0.8, cr3_ufo: 0.8,
      cr4_hotair: 1, cr4_burst: 1, cr4_seeds: 1, cr4_bubbles: 1, cr4_rain: 1,
    },
    large: { cr2_mooncat: 1.2, cr2_cloudbunny: 1.2, cr2_balloon: 1.2, cr2_castle: 0.8, cr3_rainbow: 1, cr3_rocket: 0.6, cr3_raincloud: 0.6, cr4_hotair: 1 },
    max: { cr2_mooncat: 1, cr2_cloudbunny: 1, cr2_balloon: 1, cr2_castle: 1, cr3_rainbow: 1, cr3_ufo: 1, cr3_rocket: 1, cr3_sun: 1 },
  },
  // 蠟筆花園（第八版）：花草、海邊、小動物，排在照片四周（小草、海草長在底邊）
  crayon2: {
    name: '蠟筆花園', glow: 0, noGlow: true,
    sizes: { small: [0.08, 0.1], medium: [0.11, 0.145], large: [0.17, 0.22] },
    colors: ['#9fe3c0', '#ffb98a', '#ff9fc1', '#ffe38a', '#fff3df'], recolor: 0.3,
    anchors: { cr2_grass: 'bottom', cr3_seaweed: 'bottom' },
    small: { cr2_hearts: 1, cr2_starfish: 1, cr2_shell: 1, cr2_grass: 0.8, cr3_clover: 1.2, cr3_ladybug: 1, cr3_daisy: 1.2, cr3_leaf: 1, cr3_strawberry: 0.8, cr3_bee: 0.8, cr4_burstflower: 1.2, cr4_sprout: 0.8 },
    medium: {
      cr2_sleepcat: 0.8, cr2_teacup: 0.8, cr2_jelly: 1, cr2_flower: 1.2, cr3_tulip: 1.2, cr3_mushroom: 1, cr3_snail: 1, cr3_butterfly: 1.2,
      cr3_strawberry: 1, cr3_daisy: 0.8, cr3_seaweed: 0.8, cr3_bee: 0.8, cr3_tree: 0.8,
      cr4_burstflower: 1.2, cr4_carrot: 1, cr4_watercan: 1, cr4_peapod: 1, cr4_sprout: 1,
    },
    large: { cr2_whale: 1.2, cr2_fuji: 0.8, cr2_twocats: 1, cr2_camp: 0.8, cr2_wave: 0.8, cr3_tree: 1, cr3_tulip: 0.6, cr3_mushroom: 0.6 },
    max: {
      cr2_whale: 1, cr2_fuji: 1, cr2_twocats: 1, cr2_camp: 1, cr2_wave: 1, cr2_sleepcat: 1, cr2_teacup: 1, cr3_tree: 1, cr3_snail: 1,
    },
  },
  // 法式手繪（第九版）：黑墨線＋朱紅／粉藍套色（style: 'ink'，參考圖 27 的畫法、29 的剪紙底）；'M' 是主色版
  french: {
    name: '法式手繪', glow: 0, noGlow: true, lw: 0.009,
    sizes: { small: [0.09, 0.11], medium: [0.12, 0.15], large: [0.17, 0.21] },
    colors: ['#E8553A', '#86B4E3'], recolor: 0.35,
    small: { fi_croissant: 1, fi_macaron: 1, fi_beret: 1, fi_cockade: 1, fi_pigeon: 1, fi_coffee: 0.8, fi_paris: 0.8, fi_cafe: 0.8, fi_letter: 0.8, fi_perfume: 0.8, fi_ribbon: 0.8 },
    medium: {
      fi_baguette: 1, fi_wine: 1, fi_coffee: 1, fi_mariniere: 1, fi_bike: 1, fi_car: 1, fi_umbrella: 1, fi_chair: 1, fi_books: 1, fi_bouquet: 1,
      fi_perfume: 1, fi_sign: 1, fi_pyramid: 1, fi_boat: 1, fi_lamp: 1, fi_paris: 1, fi_cafe: 1, fi_ribbon: 1, fi_pigeon: 1, fi_letter: 1,
    },
    large: { fi_eiffel: 1.2, fi_sacre: 1, fi_arc: 1, fi_carousel: 1, fi_balcony: 1, fi_awning: 1, fi_column: 1, fi_bridge: 1, fi_pyramid: 0.8, fi_car: 0.6 },
    max: { fi_eiffel: 1, fi_sacre: 1, fi_arc: 1, fi_carousel: 1, fi_balcony: 1, fi_awning: 1, fi_column: 1, fi_bridge: 1, fi_paris: 1, fi_cafe: 1, fi_sign: 1 },
  },
  // 日式手繪（第八版）：木版畫色塊（招財貓、鯉魚、飯糰臉不放）
  japan: {
    name: '日式手繪', glow: 0, noGlow: true, lw: 0.0034,
    small: { jp_sakura: 1.6, jp_ume: 1.2, jp_maple: 1.2, jp_wave: 0.8, jp_bamboo: 0.8, jp_kiku: 0.8, jp_suzu: 0.8, jp_chopsticks: 0.6, jp_ginkgo: 1 },
    medium: {
      jp_cloud: 1, jp_fan: 1, jp_dango: 1, jp_lantern: 1, jp_wagasa: 1, jp_yunomi: 1, jp_matcha: 1, jp_furin: 1, jp_crane: 1,
      jp_geta: 0.8, jp_sensu: 1, jp_kiku: 1, jp_kite: 1, jp_suzu: 0.8, jp_chopsticks: 0.6, jp_maple: 0.8,
      jp_ginkgo: 1, jp_kakigori: 1, jp_koma: 1, jp_asagao: 1, jp_hyotan: 1,
    },
    large: { jp_fuji: 1, jp_torii: 1, jp_pine: 1, jp_tsukimi: 1, jp_wisteria: 1, jp_cloud: 0.6, jp_sensu: 0.6, jp_asagao: 0.6 },
    max: { jp_fuji: 1, jp_torii: 1, jp_tsukimi: 1, jp_pine: 1, jp_wisteria: 1 },
  },
  // Y2K（第八版）：褪色的孔版印刷感
  y2k: {
    name: 'Y2K', glow: 0, noGlow: true, lw: 0.0034,
    small: { y2k_glitter: 1.4, y2k_bolt: 1, y2k_cherry: 1, y2k_daisy: 1, y2k_cursor: 0.8, y2k_heartlock: 0.8, y2k_lipgloss: 0.8, y2k_orbit: 0.8, y2k_flowerpower: 0.8 },
    medium: {
      y2k_flip: 1, y2k_cd: 1, y2k_planet: 1, y2k_butterfly: 1, y2k_chromestar: 1, y2k_chromeheart: 1, y2k_checkheart: 1, y2k_mp3: 1,
      y2k_headphones: 1, y2k_digicam: 1, y2k_gamepad: 1, y2k_pager: 1, y2k_hairclip: 0.8, y2k_disco: 1, y2k_globe: 0.8, y2k_window: 1, y2k_dice: 1,
      y2k_cassette: 1, y2k_heartglasses: 1, y2k_lavalamp: 1, y2k_flowerpower: 1, y2k_charm: 1,
    },
    large: { y2k_chromestar: 1, y2k_chromeheart: 1, y2k_checkheart: 0.8, y2k_butterfly: 1, y2k_cd: 0.8, y2k_disco: 0.8, y2k_window: 0.6 },
    max: { y2k_flip: 1, y2k_cd: 2, y2k_mp3: 1, y2k_digicam: 1, y2k_pager: 1, y2k_gamepad: 1 },
  },
  // 顏文字：用字畫出來的表情（不是使用者輸入的文字）
  kao: {
    // 第八版：顏色換成像鉛筆手寫／印泥的褪色墨色（巧克力、赤陶、炭灰、灰藍、橄欖、灰紫）
    name: '顏文字', glow: 0, noGlow: true, kao: true,
    colors: ['#655047', '#B8735F', '#65645D', '#5F7D99', '#7B8A5C', '#8A7BAB'],
    sizes: { small: [0.055, 0.07], medium: [0.065, 0.08], large: [0.085, 0.1] },
    small: { '♡': 2, '☆': 1.5, '✧': 1.5, '♪': 1, '✿': 1.2, '✦': 1, '❀': 1 },
    medium: {
      '(｡•ᴗ•｡)': 1, '(*^▽^*)': 1, '(◍•ᴗ•◍)': 1, 'ʕ•ᴥ•ʔ': 1, '(≧▽≦)': 1, '(｡>﹏<｡)': 1, '( ˘ω˘ )': 1,
      '(⁎˃ᴗ˂⁎)': 1, '(＾▽＾)': 1, '(=^･ω･^=)': 1, '(•ө•)♡': 1, '(｡･ω･｡)': 1, '(・∀・)': 1, '(￣▽￣)': 1,
      '(っ˘ω˘ς)': 1, '(*ˊᗜˋ*)': 1,
    },
    large: { '♡(ˊᵕˋ)♡': 1, '(つ✧ω✧)つ': 1, 'ヾ(≧▽≦*)o': 1, '(ﾉ◕ヮ◕)ﾉ': 1, '(´｡•ᵕ•｡`)': 1, '☆(ゝω・)v': 1, '(｡♥‿♥｡)': 1 },
  },
};

// 螢光塗鴉裡的圖案都可以開霓虹光暈（貼圖面板的開關也有效）
for (const id of Object.keys({ ...PACKS.neon.small, ...PACKS.neon.medium, ...PACKS.neon.large })) {
  const d = STICKERS.find((x) => x.id === id);
  if (d) d.glowable = true;
}

// 一鍵套用（卡片）
// overlay：覆蓋整張照片的效果（不是一個一個的塗鴉），由 app.js 的 drawOverlay 畫
// section（第八版，取代 group: 'cute'）：卡片依媒材分區
//   draw 手繪｜print 印刷｜mixed 實驗媒材｜sticker 貼紙｜line 線描
export const DOODLE_SECTIONS = [['draw', '手繪'], ['print', '印刷'], ['mixed', '實驗媒材'], ['sticker', '貼紙'], ['line', '線描']];
export const DOODLE_PRESETS = [
  { id: 'none', name: '無' },
  { id: 'pencil', name: '色鉛筆小物', pack: 'pencil', layout: 'edge', count: 14, section: 'draw' },
  { id: 'crayon', name: '蠟筆天空', pack: 'crayon', layout: 'top', count: 10, section: 'draw' },
  { id: 'crayon2', name: '蠟筆花園', pack: 'crayon2', layout: 'edge', count: 14, section: 'draw' },
  { id: 'print', name: '植物版畫', pack: 'print', layout: 'corner', count: 8, section: 'print' },
  { id: 'printgrid', name: '版畫方格', overlay: 'printgrid', count: 4, section: 'print' },
  { id: 'flora', name: '花花世界', pack: 'flora', layout: 'corner', count: 12, section: 'print' },
  { id: 'japan', name: '日式手繪', pack: 'japan', layout: 'band', count: 14, section: 'print' },
  { id: 'stitch', name: '十字繡邊', overlay: 'stitch', count: 6, section: 'mixed' },
  { id: 'stipple', name: '點描植物', overlay: 'stipple', count: 4, section: 'mixed' },
  { id: 'cream', name: '奶油貼紙', pack: 'cream', layout: 'band', count: 14, section: 'sticker' },
  { id: 'y2k', name: 'Y2K', pack: 'y2k', layout: 'edge', count: 14, section: 'sticker' },
  { id: 'french', name: '法式手繪', pack: 'french', layout: 'edge', count: 12, section: 'line' },
  { id: 'pastel', name: '夢幻粉彩', pack: 'pastel', layout: 'sides', count: 16, section: 'line' },
  { id: 'neon', name: '螢光塗鴉', pack: 'neon', layout: 'band', count: 16, section: 'line' },
  { id: 'kao', name: '顏文字', pack: 'kao', layout: 'edge', count: 12, section: 'line' },
];
export const OVERLAY_COUNT = { stitch: [2, 40], stipple: [1, 14], printgrid: [2, 16] }; // 版畫方格：最多兩排，不蓋住主角
export const COUNT_MIN = 4, COUNT_MAX = 30;

const byId = new Map(STICKERS.map((d) => [d.id, d]));

// skip(id) = true 的圖案不選（例如已達每張上限、或這個排列不適合）
function pick(r, weights, used, skip = () => false, any = false) {
  let total = 0;
  const entries = Object.entries(weights).filter(([id]) => (any || byId.has(id)) && !skip(id)).map(([id, w]) => {
    const ww = w / (1 + (used.get(id) || 0) * 1.6);
    total += ww;
    return [id, ww];
  });
  if (!entries.length) return null;
  let t = r() * total;
  for (const [id, w] of entries) { if ((t -= w) <= 0) return id; }
  return entries[entries.length - 1][0];
}

function colorFor(r, def, pack) {
  if (pack.keepColor?.includes(def.id)) return def.color;
  const fixed = pack.fixed?.[def.id];
  if (fixed) return fixed[Math.floor(r() * fixed.length)];
  if (!pack.colors || !isRecolorable(def)) return def.color;
  return r() < (pack.recolor ?? 0.4) ? pack.colors[Math.floor(r() * pack.colors.length)] : def.color;
}

// aspect = 照片寬 / 高；avoidBox = 日期戳記實際範圍（照片座標 0~1：{x0,x1,y0,y1}）或 null
// 分兩步：①先當作沒有日期排好（所以開關日期時，大部分塗鴉位置不變）；
//         ②再把壓到日期的塗鴉移到別處。
export function generateDoodles(o, aspect, avoidBox = null) {
  if (!o || o.preset === 'none' || DOODLE_PRESETS.find((p) => p.id === o.preset)?.overlay) return [];
  const pack = PACKS[o.pack] || PACKS.cream;
  const fn = LAYOUT_FN[o.layout] || LAYOUT_FN.edge;
  const r = rng((o.seed || 1) * 7907 + 3);
  const sx = aspect >= 1 ? aspect : 1, sy = aspect >= 1 ? 1 : 1 / aspect;
  const scale = (o.scale || 100) / 100;
  const sizes = pack.sizes || SIZES;
  const count = Math.max(1, Math.round(o.count ?? 16));
  const glow = o.glow ?? pack.glow;
  const placed = [], slots = [], used = new Map();
  let avoid = [];
  // 避開日期用「半對角線」(0.7×大小)：寬的圖案（鯨魚、海浪）四個角也不會壓到
  const hitsAvoid = (X, Y, rad) => avoid.some((q) => Math.hypot(X - Math.max(q.X0, Math.min(X, q.X1)), Y - Math.max(q.Y0, Math.min(Y, q.Y1))) < rad);

  // 「最佳候選」取樣：找幾個合格位置，挑離其他塗鴉最遠的 → 平均、留白
  // tol：允許和別的塗鴉稍微重疊的比例（只在重新安置時用）
  const bleed = pack.bleed ?? 0.45;
  const tryPlace = (size, region, rand = r, tol = 0, tries = 160) => {
    const rad = (size / 2) * 0.82;
    const mx = Math.min(0.45, (size * bleed) / sx), my = Math.min(0.45, (size * bleed) / sy);
    let best = null, bestGap = -Infinity, found = 0;
    for (let k = 0; k < tries && found < 12; k++) {
      const x = region ? region.x0 + rand() * (region.x1 - region.x0) : mx + rand() * (1 - 2 * mx);
      const y = region ? region.y0 + rand() * (region.y1 - region.y0) : my + rand() * (1 - 2 * my);
      if (!region && rand() > fn(x, y, sx, sy)) continue;
      const X = x * sx, Y = y * sy;
      if (hitsAvoid(X, Y, size * 0.7)) continue;
      let gap = Infinity;
      for (const q of placed) gap = Math.min(gap, Math.hypot(q.X - X, q.Y - Y) - q.rad - rad);
      if (gap < -tol * rad) continue;
      found++;
      if (gap > bestGap) { bestGap = gap; best = { x, y, X, Y }; }
    }
    if (!best) return null;
    const spot = { X: best.X, Y: best.Y, rad, arad: size * 0.7 };
    placed.push(spot);
    return { x: best.x, y: best.y, spot };
  };
  // 探頭貓：只放左右兩側（0.02–0.32 或 0.68–0.98），一側放不下就試另一側
  const placeBottom = (size, vh, vw, rand = r, tol = 0) => {
    const yb = 1 - (size * (vh / vw)) / 2 / sy, half = size / 2 / sx;
    for (const left of rand() < 0.5 ? [true, false] : [false, true]) {
      const x0 = left ? 0.02 + half : 0.68 + half, x1 = left ? 0.32 - half : 0.98 - half;
      const pos = x1 >= x0 ? tryPlace(size, { x0, x1, y0: yb, y1: yb }, rand, tol) : null;
      if (pos) return pos;
    }
    return null;
  };

  // 第九版：大 1~4 個（約 12%）當主角旁的重點；中約一半；小其餘。大小差距不大，像參考圖平均散開
  const nLarge = Math.min(count, Math.max(1, Math.min(4, Math.round(count * 0.12))) + (pack.largeExtra || 0));
  const nMedium = Math.round((count - nLarge) * 0.5);
  const plan = [...Array(nLarge).fill('large'), ...Array(nMedium).fill('medium'), ...Array(count - nLarge - nMedium).fill('small')];
  for (const kind of plan) {
    // 放不下就換一個圖案再試（最多 3 次），不讓整格空掉
    const tried = new Set();
    for (let attempt = 0; attempt < 3; attempt++) {
      const skip = (cid) => tried.has(cid) || (pack.max?.[cid] && (used.get(cid) || 0) >= pack.max[cid]) ||
        (o.layout === 'top' && pack.anchors?.[cid] === 'bottom');
      const id = pick(r, pack[kind], used, skip, !!pack.kao);
      if (!id) break;
      const [lo, hi] = sizes[kind];
      if (pack.kao) {
        // 顏文字：高度 h，寬度大約是字數 × 0.62h
        const h = (lo + r() * (hi - lo)) * scale, len = [...id].length, size = Math.max(h, h * 0.62 * len);
        const pos = tryPlace(size);
        if (!pos) { tried.add(id); continue; }
        used.set(id, (used.get(id) || 0) + 1);
        slots.push({ spot: pos.spot, size, text: true, item: {
          kind: 'text', text: id, style: 'kao', color: pack.colors[Math.floor(r() * pack.colors.length)],
          x: pos.x, y: pos.y, size: h / 0.42, rot: (r() - 0.5) * 0.4, flip: false, glow,
        } });
        break;
      }
      const def = byId.get(id);
      const size = (lo + r() * (hi - lo)) * scale;
      const [vw, vh] = stickerBox(def);
      const anchor = pack.anchors?.[id];
      const pos = anchor === 'bottom' ? placeBottom(size, vh, vw) : tryPlace(size);
      if (!pos) { tried.add(id); continue; }
      used.set(id, (used.get(id) || 0) + 1);
      const loose = def.cat === 'flora' || vh / vw < 0.7;
      slots.push({ spot: pos.spot, size, anchor, vh, vw,
        item: {
          kind: 'svg', id, color: colorFor(r, def, pack), x: pos.x, y: pos.y, size, seed: 1 + Math.floor(r() * 99999),
          rot: anchor ? 0 : (r() - 0.5) * (loose ? 1.1 : 0.55), flip: r() < 0.35, lw: pack.lw, glow,
        } });
      break;
    }
  }

  // ② 只避開日期「實際的範圍」：壓到的塗鴉移到別處，其他不動
  if (avoidBox) {
    avoid = [{ X0: avoidBox.x0 * sx, X1: avoidBox.x1 * sx, Y0: avoidBox.y0 * sy, Y1: avoidBox.y1 * sy }];
    const r2 = rng((o.seed || 1) * 7907 + 17);
    for (const sl of slots) {
      if (!hitsAvoid(sl.spot.X, sl.spot.Y, sl.spot.arad)) continue;
      placed.splice(placed.indexOf(sl.spot), 1);
      // 依序放寬：原尺寸 → 縮小 15% → 允許稍微重疊
      let pos = null, k = 1;
      for (const [shrink, tol] of [[1, 0], [0.85, 0], [0.85, 0.25], [0.75, 0.4], [0.7, 0.6]]) {
        const size = sl.size * shrink;
        pos = sl.anchor === 'bottom' ? placeBottom(size, sl.vh, sl.vw, r2, tol) : tryPlace(size, undefined, r2, tol, 400);
        if (pos) { k = shrink; break; }
      }
      if (pos) {
        sl.spot = pos.spot; sl.item.x = pos.x; sl.item.y = pos.y;
        if (k !== 1) sl.item.size *= k;
      } else sl.drop = true;
    }
  }
  const items = slots.filter((sl) => !sl.drop).map((sl) => sl.item);
  // 畫的順序：大的在下、小的在上、文字最上面
  return items.sort((p, q) => (p.kind === 'text') - (q.kind === 'text') || q.size - p.size);
}

// 第八版：8-bit 像素、連連看星星、蠟筆貓咪（素材在 art/v9.js）
Object.assign(PACKS, PACKS_V9);
{
  const SEC = { pixel: 'mixed', dotstar: 'draw', cats: 'draw' };
  for (const p of PRESETS_V9) if (!DOODLE_PRESETS.some((x) => x.id === p.id)) DOODLE_PRESETS.push({ ...p, section: p.section || SEC[p.id] || 'draw' });
}
