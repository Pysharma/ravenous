"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FoodCard, type FoodCardItem } from "@/components/site/FoodCard";

type ApiItem = Omit<FoodCardItem, "isDemoData"> & { isDemoData: boolean };

type Props = {
  initialQuery?: string;
  initialCategory?: string;
  initialFoodType?: string;
  initialSort?: string;
  lockedCategory?: string;
  title?: string;
  subtitle?: string;
};

const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Rating" },
];

export function MenuBrowser({ initialQuery = "", initialCategory = "", initialFoodType = "all", initialSort = "recommended", lockedCategory }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [category, setCategory] = useState(lockedCategory ?? initialCategory);
  const [foodType, setFoodType] = useState(initialFoodType);
  const [sort, setSort] = useState(initialSort);
  const [priceBand, setPriceBand] = useState("");
  const [flags, setFlags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ApiItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const categories = useMemo(
    () => [
      { slug: "", name: "All" },
      { slug: "starters", name: "Starters" },
      { slug: "biryani", name: "Biryani" },
      { slug: "rice", name: "Rice" },
      { slug: "noodles", name: "Noodles" },
      { slug: "chinese", name: "Chinese" },
      { slug: "main-course", name: "Main Course" },
      { slug: "tandoor", name: "Tandoor" },
      { slug: "pizza", name: "Pizza" },
      { slug: "burgers", name: "Burgers" },
      { slug: "desserts", name: "Desserts" },
      { slug: "mocktails", name: "Mocktails" },
      { slug: "juices", name: "Juices" },
      { slug: "combos", name: "Combos" },
    ],
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debounced) params.set("q", debounced);
        if (category) params.set("category", category);
        if (foodType && foodType !== "all") params.set("foodType", foodType);
        if (sort) params.set("sort", sort);
        if (priceBand === "under200") params.set("maxPrice", "20000");
        if (priceBand === "200-350") {
          params.set("minPrice", "20000");
          params.set("maxPrice", "35000");
        }
        if (priceBand === "above350") params.set("minPrice", "35000");
        if (flags.includes("bestseller")) params.set("bestseller", "1");
        if (flags.includes("popular")) params.set("popular", "1");
        if (flags.includes("new")) params.set("new", "1");
        if (flags.includes("spicy")) params.set("spicy", "1");
        if (flags.includes("available")) params.set("available", "1");
        params.set("page", String(targetPage));
        params.set("perPage", "12");
        const response = await fetch(`/api/menu?${params.toString()}`, { cache: "no-store" });
        const data = (await response.json()) as { items: ApiItem[]; total: number; error?: string };
        if (id !== requestId.current) return;
        if (data.error) throw new Error(data.error);
        setItems(append ? (prev) => [...prev, ...data.items] : data.items);
        setTotal(data.total ?? 0);
        setPage(targetPage);
      } catch {
        if (id === requestId.current) setError("We couldn't load the menu right now. Please try again.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [category, debounced, flags, foodType, priceBand, sort],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  return (
    <section className="container-page py-8">
      <div className="card p-4">
        <label className="label" htmlFor="menu-search">
          Search the menu
        </label>
        <input
          id="menu-search"
          className="input"
          placeholder="Search dishes, cuisines, ingredients..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { value: "all", label: "All" },
            { value: "veg", label: "🌱 Veg" },
            { value: "nonveg", label: "🔴 Non-veg" },
            { value: "egg", label: "🥚 Egg" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFoodType(option.value)}
              className={`badge border ${foodType === option.value ? "border-ember bg-ember/15 text-[#9c3f1c]" : "border-ink/12 text-ink/65"}`}
            >
              {option.label}
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-ink/10" />
          {[
            { id: "bestseller", label: "⭐ Bestseller" },
            { id: "popular", label: "🔥 Popular" },
            { id: "new", label: "🆕 New" },
            { id: "spicy", label: "🌶 Spicy" },
            { id: "available", label: "Available now" },
          ].map((flag) => (
            <button
              key={flag.id}
              type="button"
              onClick={() => setFlags((prev) => (prev.includes(flag.id) ? prev.filter((f) => f !== flag.id) : [...prev, flag.id]))}
              className={`badge border ${flags.includes(flag.id) ? "border-moss bg-moss/15 text-moss" : "border-ink/12 text-ink/65"}`}
            >
              {flag.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="menu-sort">
              Sort by
            </label>
            <select id="menu-sort" className="select" value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="menu-price">
              Price
            </label>
            <select id="menu-price" className="select" value={priceBand} onChange={(event) => setPriceBand(event.target.value)}>
              <option value="">Any price</option>
              <option value="under200">Under ₹200</option>
              <option value="200-350">₹200 – ₹350</option>
              <option value="above350">Above ₹350</option>
            </select>
          </div>
          {!lockedCategory ? (
            <div>
              <label className="label" htmlFor="menu-category">
                Category
              </label>
              <select id="menu-category" className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-sm text-ink/60">
        {loading && !items.length ? "Loading menu…" : `${total} dish${total === 1 ? "" : "es"} found`}
      </p>

      {error ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-sm text-[#a12622]">{error}</p>
          <button type="button" className="btn btn-outline mt-3" onClick={() => void load(1, false)}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading && !items.length
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-3xl border border-ink/8 bg-white">
                <div className="skeleton aspect-[4/3] rounded-none" />
                <div className="space-y-3 p-4">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-8 w-1/3" />
                </div>
              </div>
            ))
          : items.map((item) => <FoodCard key={`${item.id}-${item.slug}`} item={item} />)}
      </div>

      {!loading && !items.length && !error ? (
        <div className="card mt-6 p-8 text-center">
          <p className="font-display text-xl">We couldn&apos;t find that dish.</p>
          <p className="mt-1 text-sm text-ink/60">Try another search term or browse our popular categories.</p>
          <Link href="/menu" className="btn btn-primary mt-4">
            Explore Menu
          </Link>
        </div>
      ) : null}

      {items.length < total ? (
        <div className="mt-8 flex justify-center">
          <button type="button" className="btn btn-dark" disabled={loading} onClick={() => void load(page + 1, true)}>
            {loading ? "Loading…" : "Load more dishes"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
