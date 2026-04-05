const ANIME_PATTERNS: [RegExp, string][] = [
  [/^Shingeki no Kyojin/i, 'Shingeki no Kyojin'],
  [/^Kimetsu no Yaiba/i, 'Kimetsu no Yaiba'],
  [/^Jujutsu Kaisen/i, 'Jujutsu Kaisen'],
  [/^Boku no Hero Academia/i, 'Boku no Hero Academia'],
  [/^Sword Art Online/i, 'Sword Art Online'],
  [/^One Punch Man/i, 'One Punch Man'],
  [/^Mob Psycho/i, 'Mob Psycho 100'],
  [/^Re:Zero/i, 'Re:Zero'],
  [/^Mushoku Tensei/i, 'Mushoku Tensei'],
  [/^Dr\.\s*Stone/i, 'Dr. Stone'],
  [/^Spy x Family/i, 'Spy x Family'],
  [/^Chainsaw Man/i, 'Chainsaw Man'],
  [/^Naruto/i, 'Naruto'],
  [/^Bleach/i, 'Bleach'],
  [/^One Piece/i, 'One Piece'],
  [/^Dragon Ball/i, 'Dragon Ball'],
  [/^Hunter x Hunter/i, 'Hunter x Hunter'],
  [/^Fullmetal Alchemist/i, 'Fullmetal Alchemist'],
  [/^Jojo no Kimyou/i, 'JoJo\'s Bizarre Adventure'],
  [/^Code Geass/i, 'Code Geass'],
  [/^Steins;?Gate/i, 'Steins;Gate'],
  [/^Tokyo Ghoul/i, 'Tokyo Ghoul'],
  [/^Fate\//i, 'Fate'],
  [/^Haikyuu/i, 'Haikyuu!!'],
  [/^Dungeon ni Deai/i, 'DanMachi'],
  [/^Tensei Shitara Slime/i, 'Tensei Shitara Slime'],
  [/^Overlord/i, 'Overlord'],
  [/^Kaguya-sama/i, 'Kaguya-sama'],
  [/^Vinland Saga/i, 'Vinland Saga'],
  [/^Blue Lock/i, 'Blue Lock'],
  [/^Gintama/i, 'Gintama'],
  [/^Oshi no Ko/i, 'Oshi no Ko'],
  [/^Sousou no Frieren/i, 'Frieren'],
  [/^Tate no Yuusha/i, 'Shield Hero'],
  [/^Neon Genesis Evangelion/i, 'Evangelion'],
  [/^Made in Abyss/i, 'Made in Abyss'],
  [/^Bocchi the Rock/i, 'Bocchi the Rock'],
  [/^Dandadan/i, 'Dandadan'],
  [/^Cowboy Bebop/i, 'Cowboy Bebop'],
  [/^Death Note/i, 'Death Note'],
  [/^Black Clover/i, 'Black Clover'],
  [/^Demon Slayer/i, 'Kimetsu no Yaiba'],
  [/^Attack on Titan/i, 'Shingeki no Kyojin'],
];

/**
 * Get the franchise/anime name from a season title.
 * If a `franchise` field was stored (from Jikan relations), prefer that.
 * Otherwise fall back to pattern matching + regex cleanup.
 */
export function getAnimeName(seasonName: string, franchise?: string): string {
  if (franchise) return franchise;

  for (const [pattern, anime] of ANIME_PATTERNS) {
    if (pattern.test(seasonName)) return anime;
  }
  return seasonName
    .replace(/\s*(Season\s*\d+|Part\s*\d+|\d+(st|nd|rd|th)\s*Season|The\s*Final\s*Season|Zoku|Shin|Kanketsu-hen|:.*$)/gi, '')
    .trim() || seasonName;
}
