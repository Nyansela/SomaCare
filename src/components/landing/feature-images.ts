// Helper function to get placeholder image paths for landing feature cards.
export function getFeatureImagePath(feature: string): string {
  const imageMap: Record<string, string> = {
    "health-vault": "/images/landing/feature-vault.jpg",
    "ai-chat": "/images/landing/feature-ai-chat.jpg",
    vitals: "/images/landing/feature-vitals.jpg",
    wellness: "/images/landing/feature-wellness.jpg",
    schedule: "/images/landing/feature-schedule.jpg",
    medverify: "/images/landing/feature-medverify.jpg",
  };
  return imageMap[feature] || "";
}
