export type RxNormDrugSuggestion = {
  rxcui?: string;
  name: string;
};

export async function searchDrugs(query: string): Promise<RxNormDrugSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query.trim())}`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      drugGroup?: {
        conceptGroup?: Array<{
          conceptProperties?: Array<{ rxcui?: string; name?: string }>;
        }>;
      };
    };
    const results: RxNormDrugSuggestion[] = [];
    const groups = data.drugGroup?.conceptGroup || [];
    for (const group of groups) {
      if (group.conceptProperties) {
        for (const prop of group.conceptProperties) {
          if (prop.name) {
            results.push({ rxcui: prop.rxcui, name: prop.name });
          }
        }
      }
    }
    return results.slice(0, 10);
  } catch {
    return [];
  }
}

export async function normalizeDrugName(name: string): Promise<{ rxcui: string | null; name: string }> {
  if (!name || name.trim().length === 0) return { rxcui: null, name };
  try {
    const res = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name.trim())}`);
    if (!res.ok) return { rxcui: null, name };
    const data = (await res.json()) as { idGroup?: { rxnormId?: string[] } };
    const rxcui = data.idGroup?.rxnormId?.[0] || null;
    return { rxcui, name: name.trim() };
  } catch {
    return { rxcui: null, name: name.trim() };
  }
}
