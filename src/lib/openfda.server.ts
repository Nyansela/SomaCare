import { loadDevVars } from "./env-loader.server";

loadDevVars();

export type OpenFdaLabelResult = {
  drugName: string;
  warnings?: string[];
  drugInteractions?: string[];
  error?: string;
};

export async function getDrugLabel(drugName: string): Promise<OpenFdaLabelResult> {
  const apiKey = process.env.OPENFDA_API_KEY;
  if (!apiKey) {
    return { drugName, error: "openfda_api_key_unset" };
  }
  try {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(
      drugName,
    )}"&api_key=${apiKey}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
      // Try generic name search fallback
      const genericUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(
        drugName,
      )}"&api_key=${apiKey}&limit=1`;
      const genericRes = await fetch(genericUrl);
      if (!genericRes.ok) {
        return { drugName, error: "no_label_found" };
      }
      const data = (await genericRes.json()) as {
        results?: Array<{
          warnings?: string[];
          drug_interactions?: string[];
        }>;
      };
      const result = data.results?.[0];
      if (!result) return { drugName, error: "no_label_found" };
      return {
        drugName,
        warnings: result.warnings,
        drugInteractions: result.drug_interactions,
      };
    }
    const data = (await res.json()) as {
      results?: Array<{
        warnings?: string[];
        drug_interactions?: string[];
      }>;
    };
    const result = data.results?.[0];
    if (!result) return { drugName, error: "no_label_found" };
    return {
      drugName,
      warnings: result.warnings,
      drugInteractions: result.drug_interactions,
    };
  } catch {
    return { drugName, error: "fetch_failed" };
  }
}
