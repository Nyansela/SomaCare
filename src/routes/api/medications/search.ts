import { createFileRoute } from "@tanstack/react-router";
import { searchDrugs } from "@/lib/rxnorm.server";

export const Route = createFileRoute("/api/medications/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q") || "";
        if (!q.trim()) {
          return Response.json({ results: [] });
        }
        const results = await searchDrugs(q);
        return Response.json({ results });
      },
    },
  },
});
