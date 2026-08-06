export const normalizeCategoryRecord = (item) => {
  if (!item) return null;
  if (typeof item === 'string') {
    const name = item.trim();
    return name ? { id: name, name, product_count: null } : null;
  }
  const name = String(item.name ?? item.category ?? item.label ?? item.title ?? '').trim();
  if (!name) return null;
  const id = item.id ?? item.category_id ?? item.value ?? name;
  return {
    id,
    name,
    product_count: item.product_count ?? item.productCount ?? null,
  };
};

export const normalizeCategoryList = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  return list.map(normalizeCategoryRecord).filter(Boolean);
};
