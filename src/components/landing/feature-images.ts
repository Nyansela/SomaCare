// Helper function to get placeholder image paths for landing feature cards.
export function getFeatureImagePath(feature: string): string {
  const imageMap: Record<string, string> = {
    "health-vault": "/images/landing/feature-vault.svg",
    "ai-chat": "/images/landing/feature-ai-chat.svg",
    vitals: "/images/landing/feature-vitals.svg",
    wellness: "/images/landing/feature-wellness.svg",
    schedule: "/images/landing/feature-schedule.svg",
    medverify: "/images/landing/feature-medverify.svg",
  };
  return imageMap[feature] || "";
}
