export type StoreItem = {
  id: string;
  name: string;
  category: "Medications" | "Devices" | "First Aid" | "Wellness" | "Personal Care";
  price: number;
  rating: number;
  reviews: number;
  prescription: boolean;
  short: string;
  image: string;
  badge?: string;
};

// Direct Unsplash photo IDs — hand-picked to actually match each product.
const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

export const STORE_CATALOG: StoreItem[] = [
  {
    id: "sku-001",
    name: "Ibuprofen 200mg — 100ct",
    category: "Medications",
    price: 12.49,
    rating: 4.7,
    reviews: 2841,
    prescription: false,
    short: "Fast-acting pain and fever relief.",
    image: img("photo-1550572017-edd951b55104"), // pill bottle + tablets
    badge: "Bestseller",
  },
  {
    id: "sku-002",
    name: "Digital Infrared Thermometer",
    category: "Devices",
    price: 34.9,
    rating: 4.6,
    reviews: 1204,
    prescription: false,
    short: "Contactless forehead reading in 1 second.",
    image: img("photo-1584362917165-526a968579e8"), // thermometer
  },
  {
    id: "sku-003",
    name: "Blood Pressure Monitor — Upper Arm",
    category: "Devices",
    price: 79.0,
    rating: 4.8,
    reviews: 3120,
    prescription: false,
    short: "Bluetooth-enabled, syncs to Soma vitals.",
    image: img("photo-1615486511484-92e172cc4fe0"), // BP cuff
    badge: "Syncs with Soma",
  },
  {
    id: "sku-004",
    name: "Pulse Oximeter — Fingertip",
    category: "Devices",
    price: 24.5,
    rating: 4.5,
    reviews: 890,
    prescription: false,
    short: "Instant SpO₂ and heart-rate readings.",
    image: img("photo-1631549916768-4119b2e5f926"), // medical device
  },
  {
    id: "sku-005",
    name: "Vitamin D3 5000 IU — 90ct",
    category: "Wellness",
    price: 15.99,
    rating: 4.8,
    reviews: 5210,
    prescription: false,
    short: "Immune and bone health support.",
    image: img("photo-1584017911766-d451b3d0e843"), // vitamins
  },
  {
    id: "sku-006",
    name: "First Aid Kit — 200 pieces",
    category: "First Aid",
    price: 42.0,
    rating: 4.9,
    reviews: 1621,
    prescription: false,
    short: "Everything for home, car and travel.",
    image: img("photo-1603398938378-e54eab446dde"), // first aid
    badge: "Editor's pick",
  },
  {
    id: "sku-007",
    name: "N95 Respirator Masks — 20 pack",
    category: "Personal Care",
    price: 18.75,
    rating: 4.6,
    reviews: 3480,
    prescription: false,
    short: "NIOSH-approved, individually wrapped.",
    image: img("photo-1584634731339-252c581abfc5"), // mask
  },
  {
    id: "sku-008",
    name: "Amoxicillin 500mg — Rx",
    category: "Medications",
    price: 22.0,
    rating: 4.4,
    reviews: 402,
    prescription: true,
    short: "Broad-spectrum antibiotic.",
    image: img("photo-1587854692152-cbe660dbde88"), // capsules
    badge: "Prescription",
  },
  {
    id: "sku-009",
    name: "Glucose Test Strips — 100ct",
    category: "Devices",
    price: 29.99,
    rating: 4.7,
    reviews: 1980,
    prescription: false,
    short: "Compatible with most major meters.",
    image: img("photo-1666214277657-e0f6b2b3b0f4"), // glucose meter
  },
  {
    id: "sku-010",
    name: "Melatonin 5mg — 120ct",
    category: "Wellness",
    price: 11.5,
    rating: 4.5,
    reviews: 2760,
    prescription: false,
    short: "Gentle sleep support, non-habit forming.",
    image: img("photo-1626516222070-91e3d3ba5c8f"), // supplement bottle
  },
  {
    id: "sku-011",
    name: "Compression Bandages — 4 pack",
    category: "First Aid",
    price: 9.99,
    rating: 4.4,
    reviews: 640,
    prescription: false,
    short: "Elastic wraps for sprains and swelling.",
    image: img("photo-1603807008857-ad66b70431aa"), // bandages
  },
  {
    id: "sku-012",
    name: "Electric Toothbrush — Sonic Pro",
    category: "Personal Care",
    price: 89.0,
    rating: 4.8,
    reviews: 4590,
    prescription: false,
    short: "40,000 strokes/min, 4 clinical modes.",
    image: img("photo-1559591935-c6c92c6ccccb"), // electric toothbrush
    badge: "New",
  },
];

export const STORE_CATEGORIES = [
  "All",
  "Medications",
  "Devices",
  "First Aid",
  "Wellness",
  "Personal Care",
] as const;

// Fallback image per category — used when the primary image fails to load.
export const CATEGORY_FALLBACK: Record<StoreItem["category"], string> = {
  Medications: img("photo-1587854692152-cbe660dbde88"),
  Devices: img("photo-1584362917165-526a968579e8"),
  "First Aid": img("photo-1603398938378-e54eab446dde"),
  Wellness: img("photo-1584017911766-d451b3d0e843"),
  "Personal Care": img("photo-1559591935-c6c92c6ccccb"),
};
