export const STORE_CATEGORIES = [
  { value: "food-drinks",    label: "Food & Drinks",      emoji: "🍔" },
  { value: "fashion",        label: "Fashion & Apparel",  emoji: "👗" },
  { value: "beauty",         label: "Beauty & Wellness",  emoji: "💄" },
  { value: "electronics",    label: "Electronics",        emoji: "📱" },
  { value: "home-garden",    label: "Home & Garden",      emoji: "🏡" },
  { value: "sports",         label: "Sports & Fitness",   emoji: "⚽" },
  { value: "arts-crafts",    label: "Arts & Crafts",      emoji: "🎨" },
  { value: "books",          label: "Books & Education",  emoji: "📚" },
  { value: "pets",           label: "Pets",               emoji: "🐾" },
  { value: "other",          label: "Other",              emoji: "🛍️" },
] as const;

export type StoreCategoryValue = typeof STORE_CATEGORIES[number]["value"];

export function getCategoryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return STORE_CATEGORIES.find((c) => c.value === value)?.label ?? null;
}

export function getCategoryEmoji(value: string | null | undefined): string | null {
  if (!value) return null;
  return STORE_CATEGORIES.find((c) => c.value === value)?.emoji ?? null;
}
