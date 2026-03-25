// Tokyo district areas — shared by 美食清單與已讚好詳情

export type TokyoArea = { id: string; zh: string; en: string }

export type TokyoDistrict = {
  id: string
  label: string
  en: string
  icon: string
  areas: TokyoArea[]
}

export const TOKYO_DISTRICTS: TokyoDistrict[] = [
  {
    id: 'east',
    label: '東東京',
    en: 'East Tokyo',
    icon: '🏮',
    areas: [
      { id: 'asakusa', zh: '浅草', en: 'Asakusa' },
      { id: 'ueno', zh: '上野', en: 'Ueno' },
      { id: 'akihabara', zh: '秋葉原', en: 'Akihabara' },
      { id: 'yanaka', zh: '谷根千', en: 'Yanaka' },
      { id: 'kuramae', zh: '蔵前', en: 'Kuramae' },
      { id: 'kiyosumishirakawa', zh: '清澄白河', en: 'Kiyosumi-Shirakawa' },
      { id: 'ryogoku', zh: '両国', en: 'Ryogoku' },
      { id: 'kinshicho', zh: '錦糸町', en: 'Kinshicho' },
      { id: 'kitasenju', zh: '北千住', en: 'Kita-Senju' },
    ],
  },
  {
    id: 'shibuya_area',
    label: '渋谷エリア',
    en: 'Shibuya Area',
    icon: '🛍️',
    areas: [
      { id: 'shibuya', zh: '渋谷', en: 'Shibuya' },
      { id: 'harajuku', zh: '原宿', en: 'Harajuku' },
      { id: 'omotesando', zh: '表参道', en: 'Omotesando' },
      { id: 'aoyama', zh: '青山', en: 'Aoyama' },
      { id: 'ebisu', zh: '恵比寿', en: 'Ebisu' },
      { id: 'daikanyama', zh: '代官山', en: 'Daikanyama' },
      { id: 'nakameguro', zh: '中目黒', en: 'Nakameguro' },
    ],
  },
  {
    id: 'shinjuku_area',
    label: '新宿エリア',
    en: 'Shinjuku Area',
    icon: '🌃',
    areas: [
      { id: 'shinjuku', zh: '新宿', en: 'Shinjuku' },
      { id: 'shimokitazawa', zh: '下北沢', en: 'Shimokitazawa' },
      { id: 'sangenjaya', zh: '三軒茶屋', en: 'Sangenjaya' },
      { id: 'jiyugaoka', zh: '自由が丘', en: 'Jiyugaoka' },
      { id: 'futakotamagawa', zh: '二子玉川', en: 'Futakotamagawa' },
    ],
  },
  {
    id: 'central',
    label: '都心',
    en: 'Central Tokyo',
    icon: '🏙️',
    areas: [
      { id: 'ginza', zh: '銀座', en: 'Ginza' },
      { id: 'tsukiji', zh: '築地', en: 'Tsukiji' },
      { id: 'shimbashi', zh: '新橋', en: 'Shimbashi' },
      { id: 'nihonbashi', zh: '日本橋', en: 'Nihonbashi' },
      { id: 'yurakucho', zh: '有楽町', en: 'Yurakucho' },
      { id: 'marunouchi', zh: '丸の内', en: 'Marunouchi' },
      { id: 'otemachi', zh: '大手町', en: 'Otemachi' },
    ],
  },
  {
    id: 'minato',
    label: '港区',
    en: 'Minato',
    icon: '🌆',
    areas: [
      { id: 'roppongi', zh: '六本木', en: 'Roppongi' },
      { id: 'akasaka', zh: '赤坂', en: 'Akasaka' },
      { id: 'azabujuban', zh: '麻布十番', en: 'Azabu-Juban' },
      { id: 'hiro', zh: '広尾', en: 'Hiro' },
    ],
  },
  {
    id: 'north',
    label: '北エリア',
    en: 'North Area',
    icon: '🎓',
    areas: [
      { id: 'ikebukuro', zh: '池袋', en: 'Ikebukuro' },
      { id: 'kagurazaka', zh: '神楽坂', en: 'Kagurazaka' },
      { id: 'iidabashi', zh: '飯田橋', en: 'Iidabashi' },
      { id: 'jimbocho', zh: '神保町', en: 'Jimbocho' },
      { id: 'ochanomizu', zh: '御茶ノ水', en: 'Ochanomizu' },
    ],
  },
  {
    id: 'west',
    label: '西エリア',
    en: 'West Area',
    icon: '🌿',
    areas: [
      { id: 'kichijoji', zh: '吉祥寺', en: 'Kichijoji' },
      { id: 'koenji', zh: '高円寺', en: 'Koenji' },
      { id: 'ogikubo', zh: '荻窪', en: 'Ogikubo' },
    ],
  },
  {
    id: 'bay',
    label: '湾岸',
    en: 'Bay Area',
    icon: '🌊',
    areas: [
      { id: 'toyosu', zh: '豊洲', en: 'Toyosu' },
      { id: 'odaiba', zh: '台場', en: 'Odaiba' },
      { id: 'shinagawa', zh: '品川', en: 'Shinagawa' },
    ],
  },
  {
    id: 'suburbs',
    label: '郊外',
    en: 'Suburbs',
    icon: '🌸',
    areas: [
      { id: 'machida', zh: '町田', en: 'Machida' },
      { id: 'tachikawa', zh: '立川', en: 'Tachikawa' },
    ],
  },
]

export const TOKYO_AREAS: TokyoArea[] = TOKYO_DISTRICTS.flatMap(d => d.areas)
