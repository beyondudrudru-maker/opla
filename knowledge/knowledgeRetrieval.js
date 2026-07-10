function buildDomains({ rawGoldData, rawGemData }) {
  return [
    {
      name: 'gold',
      match: (text) => text.includes('gold guide') || text.includes('gold'),
      instruction: "CRITICAL INSTRUCTION: If the player mentions a specific amount of gold, you MUST use the 50-20-10-20 ratio from the Blueprint to calculate EXACTLY how much gold goes into each category. Show them the exact calculated numbers in your response.",
      data: rawGoldData,
    },
    {
      name: 'gem',
      match: (text) => text.includes('gem guide') || text.includes('gem') || text.includes('gems'),
      instruction: "CRITICAL INSTRUCTION: If the player mentions a specific amount of gems, you MUST use the 40-20-20-10-10 matrix from the Blueprint to calculate EXACTLY how many gems go into each category. Show them the exact calculated numbers in your response.",
      data: rawGemData,
    },
  ];
}

function retrieve(content, sources) {
  const text = (content || '').toLowerCase();
  const domains = buildDomains(sources);
  const hit = domains.find((d) => d.match(text));
  if (!hit) return null;
  return `[SYSTEM RULE]: You are the !NF!N!TY Clan Tactical AI.\nBelow is the FULL official ${hit.name === 'gold' ? 'Gold' : 'Gem'} Data.\n${hit.instruction}\n[OFFICIAL FULL ${hit.name.toUpperCase()} DATA]:\n${hit.data}`;
}

module.exports = { retrieve };