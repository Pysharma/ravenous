import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  addons,
  adminUsers,
  categories,
  coupons,
  deliveryZones,
  favorites,
  homepageSections,
  inventoryItems,
  legalPages,
  media,
  menuItemAddons,
  menuItems,
  menuVariants,
  notifications,
  orderItems,
  orderStatusHistory,
  orders,
  restaurantSettings,
  restaurantTables,
  reservations,
  reviews,
  roles,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { ROLE_PRESETS } from "@/lib/permissions";
import { DEFAULT_HOURS, DEFAULT_DELIVERY, DEFAULT_ORDERING, DEFAULT_PAYMENT, DEFAULT_RESERVATION, DEFAULT_TAX } from "@/lib/settings";
import { slugify } from "@/lib/format";

type SeedItem = {
  name: string;
  category: string;
  cuisine: string;
  price: number;
  mrp?: number;
  desc: string;
  ingredients: string;
  foodType?: "veg" | "nonveg" | "egg";
  spicy?: string;
  prep?: number;
  serving?: string;
  tags?: string;
  bestseller?: boolean;
  popular?: boolean;
  featured?: boolean;
  isNew?: boolean;
  recommended?: boolean;
  customize?: boolean;
  allergens?: string;
  image: string;
  variants?: { name: string; price: number; mrp?: number; def?: boolean }[];
};

const IMAGES = {
  hero: "/images/hero-dish.jpg",
  biryani: "/images/biryani.jpg",
  rice: "/images/fried-rice.jpg",
  chinese: "/images/chinese-starter.jpg",
  noodles: "/images/noodles.jpg",
  indian: "/images/paneer-curry.jpg",
  drinks: "/images/juice-mocktails.jpg",
  dessert: "/images/dessert.jpg",
  interior: "/images/interior.jpg",
  exterior: "/images/exterior.jpg",
};

const CATEGORY_SEED: { name: string; image: string; prep: number; description: string }[] = [
  { name: "Starters", image: IMAGES.chinese, prep: 15, description: "Crispy, spicy and perfect to start the meal." },
  { name: "Soups", image: IMAGES.noodles, prep: 12, description: "Warm bowls of Indo-Chinese and continental soups." },
  { name: "Chinese", image: IMAGES.chinese, prep: 18, description: "Wok-tossed Indo-Chinese favourites." },
  { name: "Indian", image: IMAGES.indian, prep: 20, description: "Comforting Indian classics." },
  { name: "North Indian", image: IMAGES.indian, prep: 22, description: "Rich curries, tandoori breads and more." },
  { name: "South Indian", image: IMAGES.rice, prep: 15, description: "Dosas, idli and South Indian specials." },
  { name: "Biryani", image: IMAGES.biryani, prep: 30, description: "Slow-cooked dum biryanis with raita." },
  { name: "Rice", image: IMAGES.rice, prep: 18, description: "Fried rice, pulao and combos." },
  { name: "Noodles", image: IMAGES.noodles, prep: 16, description: "Hakka, schezwan and chowmein noodles." },
  { name: "Pasta", image: IMAGES.indian, prep: 18, description: "Creamy and tangy pasta favourites." },
  { name: "Pizza", image: IMAGES.hero, prep: 25, description: "Hand-stretched pizzas with generous toppings." },
  { name: "Burgers", image: IMAGES.hero, prep: 15, description: "Loaded veg and chicken burgers." },
  { name: "Sandwiches", image: IMAGES.hero, prep: 12, description: "Grilled sandwiches and club classics." },
  { name: "Tandoor", image: IMAGES.indian, prep: 24, description: "Clay oven kebabs and tikkas." },
  { name: "Main Course", image: IMAGES.indian, prep: 22, description: "Curries designed for sharing." },
  { name: "Desserts", image: IMAGES.dessert, prep: 10, description: "Sweet endings." },
  { name: "Beverages", image: IMAGES.drinks, prep: 8, description: "Hot and cold beverages." },
  { name: "Mocktails", image: IMAGES.drinks, prep: 10, description: "Fresh, fizzy and refreshing." },
  { name: "Juices", image: IMAGES.drinks, prep: 10, description: "Freshly squeezed juices." },
  { name: "Kids", image: IMAGES.hero, prep: 12, description: "Small plates for little guests." },
  { name: "Combos", image: IMAGES.hero, prep: 25, description: "Complete meals at a friendly price." },
];

const MENU_SEED: SeedItem[] = [
  { name: "Veg Manchurian Dry", category: "Starters", cuisine: "Indo-Chinese", price: 22000, mrp: 26000, desc: "Crisp vegetable balls tossed in spicy Manchurian sauce.", ingredients: "Cabbage, carrot, corn flour, garlic, chilli, soy sauce", prep: 15, spicy: "spicy", tags: "manchurian, crispy, starter", image: IMAGES.chinese, bestseller: true, popular: true, allergens: "Gluten, Soy", customize: true },
  { name: "Chilli Paneer Dry", category: "Starters", cuisine: "Indo-Chinese", price: 26000, mrp: 29000, desc: "Paneer cubes wok-tossed with capsicum, onion and sesame.", ingredients: "Paneer, capsicum, onion, chilli, sesame, soy sauce", prep: 15, spicy: "spicy", tags: "paneer, chilli paneer, starter", image: IMAGES.chinese, bestseller: true, customize: true, allergens: "Dairy, Soy" },
  { name: "Chicken 65", category: "Starters", cuisine: "South Indian", price: 30000, desc: "Spicy fried chicken bites with curry leaves and yoghurt dip.", ingredients: "Chicken, curry leaves, red chilli, ginger garlic, yoghurt", foodType: "nonveg", prep: 18, spicy: "extra_spicy", tags: "chicken, 65, fried", image: IMAGES.chinese, popular: true, customize: true },
  { name: "Paneer Tikka Dry", category: "Starters", cuisine: "Tandoor", price: 28000, mrp: 32000, desc: "Char-grilled paneer with bell peppers and mint chutney.", ingredients: "Paneer, capsicum, onion, hung curd, spices", prep: 20, spicy: "medium", tags: "tandoor, paneer, tikka", image: IMAGES.indian, featured: true, customize: true, allergens: "Dairy" },
  { name: "Hot & Sour Soup", category: "Soups", cuisine: "Indo-Chinese", price: 14000, desc: "Peppery soup with finely julienned vegetables.", ingredients: "Cabbage, carrot, spring onion, vinegar, pepper", prep: 12, spicy: "medium", tags: "soup, hot and sour", image: IMAGES.noodles, customize: true },
  { name: "Chicken Sweet Corn Soup", category: "Soups", cuisine: "Indo-Chinese", price: 16000, desc: "Creamy corn soup with shredded chicken.", ingredients: "Sweet corn, chicken, egg white, spring onion", foodType: "nonveg", prep: 12, tags: "soup, sweet corn", image: IMAGES.noodles, allergens: "Egg" },
  { name: "Schezwan Veg Fried Rice", category: "Rice", cuisine: "Indo-Chinese", price: 21000, mrp: 24000, desc: "Wok-fired rice with house schezwan sauce.", ingredients: "Basmati rice, capsicum, carrot, spring onion, schezwan sauce", prep: 16, spicy: "spicy", tags: "fried rice, schezwan, rice", image: IMAGES.rice, bestseller: true, popular: true, recommend: false, customize: true } as unknown as SeedItem,
  { name: "Egg Fried Rice", category: "Rice", cuisine: "Indo-Chinese", price: 20000, desc: "Classic fried rice with egg, spring onion and soy.", ingredients: "Rice, egg, spring onion, soy sauce, pepper", foodType: "egg", prep: 15, tags: "fried rice, egg", image: IMAGES.rice, recommended: true, customize: true, allergens: "Egg, Soy" },
  { name: "Chicken Fried Rice", category: "Rice", cuisine: "Indo-Chinese", price: 24000, mrp: 27000, desc: "Fried rice tossed with tender chicken and mild spices.", ingredients: "Rice, chicken, egg, spring onion, soy sauce", foodType: "nonveg", prep: 18, tags: "fried rice, chicken, rice", image: IMAGES.rice, popular: true, customize: true, allergens: "Egg, Soy" },
  { name: "Veg Hakka Noodles", category: "Noodles", cuisine: "Indo-Chinese", price: 20000, desc: "Silky noodles with crunchy garden vegetables.", ingredients: "Noodles, cabbage, carrot, capsicum, spring onion", prep: 15, tags: "noodles, hakka, veg", image: IMAGES.noodles, popular: true, customize: true, allergens: "Gluten" },
  { name: "Schezwan Chicken Noodles", category: "Noodles", cuisine: "Indo-Chinese", price: 25000, mrp: 28000, desc: "Spicy schezwan noodles with shredded chicken.", ingredients: "Noodles, chicken, schezwan sauce, capsicum, onion", foodType: "nonveg", prep: 18, spicy: "extra_spicy", tags: "noodles, schezwan, chicken", image: IMAGES.noodles, bestseller: true, customize: true, allergens: "Gluten" },
  { name: "Veg Manchow Noodles", category: "Noodles", cuisine: "Indo-Chinese", price: 22000, desc: "Noodles in a thick Manchow-style sauce with crispy garlic.", ingredients: "Noodles, garlic, cabbage, carrot, chilli oil", prep: 16, spicy: "spicy", tags: "noodles, manchow", image: IMAGES.noodles, customize: true, allergens: "Gluten" },
  { name: "Hyderabadi Chicken Dum Biryani", category: "Biryani", cuisine: "Hyderabadi", price: 32000, mrp: 38000, desc: "Dum-cooked biryani with saffron rice, raita and salan.", ingredients: "Basmati rice, chicken, saffron, fried onion, yoghurt, whole spices", foodType: "nonveg", prep: 32, tags: "biryani, chicken, dum, hyderabadi", image: IMAGES.biryani, bestseller: true, featured: true, popular: true, customize: true, allergens: "Dairy", variants: [ { name: "Half", price: 21000, mrp: 24000 }, { name: "Full", price: 36000, mrp: 42000, def: true }, { name: "Family", price: 65000, mrp: 72000 } ] },
  { name: "Egg Biryani", category: "Biryani", cuisine: "Hyderabadi", price: 22000, mrp: 26000, desc: "Aromatic biryani layered with masala eggs and raita.", ingredients: "Basmati rice, egg, fried onion, mint, spices", foodType: "egg", prep: 28, tags: "biryani, egg", image: IMAGES.biryani, popular: true, customize: true, allergens: "Egg, Dairy", variants: [ { name: "Half", price: 15000, mrp: 17000 }, { name: "Full", price: 25000, mrp: 29000, def: true } ] },
  { name: "Veg Dum Biryani", category: "Biryani", cuisine: "Hyderabadi", price: 24000, mrp: 28000, desc: "Fragrant vegetable biryani with paneer and cashew.", ingredients: "Basmati rice, mixed vegetables, paneer, cashew, saffron", prep: 28, tags: "biryani, veg, paneer", image: IMAGES.biryani, recommended: true, customize: true, allergens: "Dairy, Nuts" },
  { name: "Paneer Butter Masala", category: "Main Course", cuisine: "North Indian", price: 28000, mrp: 32000, desc: "Silky tomato-cashew gravy with soft paneer cubes.", ingredients: "Paneer, tomato, cashew, butter, cream, kasuri methi", prep: 22, tags: "paneer, butter masala, curry", image: IMAGES.indian, bestseller: true, featured: true, customize: true, allergens: "Dairy, Nuts", variants: [ { name: "Half", price: 19000 }, { name: "Full", price: 30000, def: true } ] },
  { name: "Dal Tadka", category: "Indian", cuisine: "North Indian", price: 18000, desc: "Yellow lentils finished with ghee tempering.", ingredients: "Toor dal, ghee, garlic, cumin, red chilli", prep: 20, tags: "dal, tadka, indian", image: IMAGES.indian, customize: true, allergens: "Dairy" },
  { name: "Kadai Chicken", category: "Main Course", cuisine: "North Indian", price: 34000, mrp: 38000, desc: "Chicken cooked with kadai masala and bell peppers.", ingredients: "Chicken, capsicum, onion, tomato, kadai masala", foodType: "nonveg", prep: 25, spicy: "spicy", tags: "chicken, kadai, curry", image: IMAGES.indian, popular: true, customize: true, variants: [ { name: "Half", price: 24000 }, { name: "Full", price: 36000, def: true } ] },
  { name: "Butter Naan", category: "North Indian", cuisine: "Tandoor", price: 5000, desc: "Soft tandoori naan brushed with butter.", ingredients: "Refined flour, yoghurt, butter", prep: 8, tags: "naan, bread, tandoor", image: IMAGES.indian, allergenFree: true } as unknown as SeedItem,
  { name: "Garlic Naan", category: "North Indian", cuisine: "Tandoor", price: 6000, desc: "Naan studded with garlic and coriander.", ingredients: "Flour, garlic, coriander, butter", prep: 9, tags: "naan, garlic, tandoor", image: IMAGES.indian },
  { name: "Chicken Tikka", category: "Tandoor", cuisine: "Tandoor", price: 32000, mrp: 36000, desc: "Yoghurt-marinated chicken skewers from the clay oven.", ingredients: "Chicken, hung curd, ginger garlic, garam masala", foodType: "nonveg", prep: 24, spicy: "medium", tags: "tikka, tandoor, chicken", image: IMAGES.indian, featured: true, customize: true, variants: [ { name: "Half", price: 22000 }, { name: "Full", price: 34000, def: true } ] },
  { name: "Masala Dosa", category: "South Indian", cuisine: "South Indian", price: 14000, desc: "Crisp dosa with spiced potato filling, sambar and chutney.", ingredients: "Rice batter, potato, mustard, curry leaves, coconut", prep: 15, tags: "dosa, south indian, breakfast", image: IMAGES.rice, customize: true },
  { name: "Idli Sambar", category: "South Indian", cuisine: "South Indian", price: 11000, desc: "Steamed idli with sambar and two chutneys.", ingredients: "Rice, urad dal, sambar, coconut", prep: 12, tags: "idli, sambar, breakfast", image: IMAGES.rice },
  { name: "Margherita Pizza", category: "Pizza", cuisine: "Italian", price: 26000, mrp: 30000, desc: "Classic cheese and herb pizza on a hand-stretched base.", ingredients: "Pizza dough, mozzarella, tomato sauce, oregano, basil", prep: 25, tags: "pizza, cheese, margherita", image: IMAGES.hero, customize: true, allergens: "Gluten, Dairy", variants: [ { name: "Regular 7\"", price: 26000, def: true }, { name: "Medium 9\"", price: 38000, mrp: 42000 }, { name: "Large 12\"", price: 52000, mrp: 58000 } ] },
  { name: "Chicken Tikka Pizza", category: "Pizza", cuisine: "Italian", price: 34000, desc: "Tandoori chicken, onion and extra cheese.", ingredients: "Pizza dough, chicken tikka, mozzarella, onion, mint mayo", foodType: "nonveg", prep: 26, spicy: "medium", tags: "pizza, chicken, tikka", image: IMAGES.hero, bestseller: true, customize: true, allergens: "Gluten, Dairy", variants: [ { name: "Regular 7\"", price: 34000, def: true }, { name: "Medium 9\"", price: 46000 }, { name: "Large 12\"", price: 62000 } ] },
  { name: "Veg Alfredo Pasta", category: "Pasta", cuisine: "Italian", price: 26000, desc: "Creamy white sauce penne with vegetables and herbs.", ingredients: "Penne, cream, garlic, broccoli, capsicum, parmesan", prep: 20, tags: "pasta, alfredo, veg", image: IMAGES.indian, customize: true, allergens: "Gluten, Dairy" },
  { name: "Paneer Makhani Burger", category: "Burgers", cuisine: "Continental", price: 18000, desc: "Grilled paneer patty, makhani sauce and slaw in a bun.", ingredients: "Burger bun, paneer, makhani sauce, lettuce, cheese", prep: 15, tags: "burger, paneer, fast food", image: IMAGES.hero, customize: true, allergens: "Gluten, Dairy" },
  { name: "Crispy Chicken Burger", category: "Burgers", cuisine: "Continental", price: 22000, desc: "Spicy fried chicken fillet with cheese and mayo.", ingredients: "Burger bun, chicken fillet, cheese, mayo, lettuce", foodType: "nonveg", prep: 16, spicy: "medium", tags: "burger, chicken", image: IMAGES.hero, popular: true, customize: true, allergens: "Gluten, Egg" },
  { name: "Grilled Veg Club Sandwich", category: "Sandwiches", cuisine: "Continental", price: 17000, desc: "Triple-decker sandwich with cheese and veggies.", ingredients: "Bread, cheese, tomato, cucumber, potato, chutney", prep: 14, tags: "sandwich, club, veg", image: IMAGES.hero, customize: true, allergens: "Gluten, Dairy" },
  { name: "Schezwan Momos", category: "Chinese", cuisine: "Tibetan", price: 19000, desc: "Steamed veg momos with fiery schezwan chutney.", ingredients: "Flour, cabbage, carrot, schezwan chutney", prep: 16, spicy: "spicy", tags: "momos, chinese, starter", image: IMAGES.chinese, isNew: true, customize: true, allergens: "Gluten" },
  { name: "Chicken Manchurian Gravy", category: "Chinese", cuisine: "Indo-Chinese", price: 28000, desc: "Chicken balls in a glossy Manchurian gravy.", ingredients: "Chicken, garlic, soy sauce, corn flour, spring onion", foodType: "nonveg", prep: 20, tags: "manchurian, chicken, chinese", image: IMAGES.chinese, customize: true, allergens: "Soy, Gluten" },
  { name: "Gulab Jamun (2 pc)", category: "Desserts", cuisine: "Indian", price: 9000, desc: "Warm milk dumplings soaked in cardamom syrup.", ingredients: "Milk solids, sugar, cardamom, ghee", prep: 8, tags: "dessert, gulab jamun, sweet", image: IMAGES.dessert, popular: true, allergens: "Dairy" },
  { name: "Chocolate Lava Cake", category: "Desserts", cuisine: "Continental", price: 14000, mrp: 16000, desc: "Molten chocolate cake served warm.", ingredients: "Dark chocolate, flour, butter, egg, vanilla ice cream", foodType: "egg", prep: 12, tags: "dessert, chocolate, cake", image: IMAGES.dessert, featured: true, allergens: "Gluten, Dairy, Egg" },
  { name: "Fresh Lime Soda", category: "Beverages", cuisine: "Beverages", price: 8000, desc: "Sweet or salted fresh lime soda.", ingredients: "Lime, sugar, soda, mint", prep: 6, tags: "beverage, lime, soda", image: IMAGES.drinks, customize: true },
  { name: "Masala Chai", category: "Beverages", cuisine: "Beverages", price: 5000, desc: "Strong milk tea with ginger and cardamom.", ingredients: "Tea, milk, ginger, cardamom", prep: 7, tags: "tea, chai", image: IMAGES.drinks, allergens: "Dairy" },
  { name: "Virgin Mojito", category: "Mocktails", cuisine: "Mocktail", price: 15000, mrp: 17000, desc: "Mint, lime and soda over crushed ice.", ingredients: "Mint, lime, sugar syrup, soda, ice", prep: 8, tags: "mocktail, mojito, mint", image: IMAGES.drinks, bestseller: true, customize: true },
  { name: "Blue Lagoon Mocktail", category: "Mocktails", cuisine: "Mocktail", price: 16000, desc: "Citrus blue curacao mocktail with a lemon wedge.", ingredients: "Blue curacao syrup, lemon, soda, ice", prep: 8, tags: "mocktail, blue lagoon", image: IMAGES.drinks, isNew: true, customize: true },
  { name: "Fresh Orange Juice", category: "Juices", cuisine: "Juice", price: 12000, desc: "Cold-pressed oranges, no added sugar.", ingredients: "Orange", prep: 8, tags: "juice, orange, fresh", image: IMAGES.drinks, popular: true, customize: true },
  { name: "Watermelon Cooler", category: "Juices", cuisine: "Juice", price: 12000, desc: "Chilled watermelon juice with mint.", ingredients: "Watermelon, mint, lime", prep: 8, tags: "juice, watermelon", image: IMAGES.drinks },
  { name: "Mini Cheese Pizza", category: "Kids", cuisine: "Italian", price: 18000, desc: "Kid-sized cheese pizza with a smiley potato side.", ingredients: "Pizza dough, cheese, tomato sauce", prep: 15, tags: "kids, pizza, cheese", image: IMAGES.hero, allergens: "Gluten, Dairy" },
  { name: "Biryani Combo Meal", category: "Combos", cuisine: "Hyderabadi", price: 38000, mrp: 46000, desc: "Chicken dum biryani, raita, salad, sweet and a soft drink.", ingredients: "Biryani, raita, salad, gulab jamun, soft drink", foodType: "nonveg", prep: 32, tags: "combo, biryani, meal", image: IMAGES.hero, featured: true, popular: true, customize: true, allergens: "Dairy" },
  { name: "Veg Chinese Combo", category: "Combos", cuisine: "Indo-Chinese", price: 32000, mrp: 38000, desc: "Veg fried rice, veg Manchurian dry and a soft drink.", ingredients: "Fried rice, manchurian, soft drink", prep: 25, tags: "combo, chinese, veg", image: IMAGES.chinese, recommended: true, customize: true, allergens: "Gluten, Soy" },
];

const ADDON_SEED = [
  { name: "Extra Cheese", price: 4000, group: "Extras" },
  { name: "Extra Paneer", price: 6000, group: "Extras" },
  { name: "Extra Chicken", price: 8000, group: "Extras" },
  { name: "Extra Sauce", price: 2000, group: "Extras" },
  { name: "Extra Vegetables", price: 3000, group: "Extras" },
  { name: "Extra Gravy", price: 5000, group: "Extras" },
  { name: "Butter Naan", price: 3500, group: "Sides" },
  { name: "Raita", price: 4000, group: "Sides" },
  { name: "Masala Papad", price: 3000, group: "Sides" },
  { name: "Soft Drink", price: 4000, group: "Drinks" },
  { name: "Cheese Burst Crust", price: 6000, group: "Pizza" },
  { name: "Jain Preparation (No Onion/Garlic)", price: 0, group: "Preferences" },
];

const INVENTORY_SEED = [
  { name: "Paneer", unit: "kg", stock: 18, low: 5, cost: 38000, supplier: "Sharma Dairy" },
  { name: "Chicken", unit: "kg", stock: 22, low: 8, cost: 24000, supplier: "Fresh Meat Co." },
  { name: "Basmati Rice", unit: "kg", stock: 60, low: 15, cost: 11000, supplier: "Bilaspur Grains" },
  { name: "Mozzarella Cheese", unit: "kg", stock: 9, low: 4, cost: 42000, supplier: "Dairy Craft" },
  { name: "Refined Flour", unit: "kg", stock: 34, low: 10, cost: 4000, supplier: "Bilaspur Grains" },
  { name: "Mixed Vegetables", unit: "kg", stock: 26, low: 10, cost: 6000, supplier: "Local Mandi" },
  { name: "Schechwan Sauce", unit: "ltr", stock: 6, low: 3, cost: 18000, supplier: "Asian Foods" },
  { name: "Soft Drinks", unit: "bottle", stock: 40, low: 12, cost: 2000, supplier: "Beverage Depot" },
  { name: "Cooking Oil", unit: "ltr", stock: 30, low: 8, cost: 13000, supplier: "Wholesale Mart" },
  { name: "Garlic", unit: "kg", stock: 4, low: 5, cost: 12000, supplier: "Local Mandi" },
  { name: "Fresh Cream", unit: "ltr", stock: 2, low: 4, cost: 20000, supplier: "Sharma Dairy" },
  { name: "Gulab Jamun Mix", unit: "kg", stock: 7, low: 3, cost: 15000, supplier: "Sweet Supplies" },
];

const ZONE_SEED = [
  { name: "0 – 2 km (Core)", min: 0, max: 2, fee: 2000, minOrder: 14900, extra: 0, pincodes: "495001" },
  { name: "2 – 5 km", min: 2, max: 5, fee: 3000, minOrder: 19900, extra: 0, pincodes: "495001,495004" },
  { name: "5 – 8 km", min: 5, max: 8, fee: 5000, minOrder: 29900, extra: 1000, pincodes: "495004,495006" },
  { name: "8 – 10 km (Far)", min: 8, max: 10, fee: 7000, minOrder: 39900, extra: 1500, pincodes: "495006,495009" },
];

const LOCATIONS = [
  "Vyapar Vihar", "Mangal Chowk", "Sarkanda", "Vidya Nagar", "Nehru Nagar", "Tifra",
  "Bus Stand", "Gol Bazar", "Ratanpur Road", "Sirgitti", "Sendri", "Koni",
];

export async function seedDatabase(force = false) {
  const existing = await db.select({ id: restaurantSettings.id }).from(restaurantSettings).limit(1);
  if (existing.length && !force) return { seeded: false, reason: "already-seeded" };

  if (force) {
    await db.execute(sql`truncate table
      order_item_addons, order_items, order_status_history, orders, payments, refunds,
      coupon_redemptions, delivery_assignments, favorites, notifications, notification_logs,
      support_tickets, reviews, reservations, menu_item_addons, menu_variants, recipes,
      menu_items, categories, addons, inventory_items, coupons, delivery_zones,
      restaurant_tables, media, homepage_sections, legal_pages, audit_logs, coupon_redemptions
      restart identity cascade`);
  }

  /* ---------------------------------------------------------------- roles */
  for (const preset of ROLE_PRESETS) {
    await db
      .insert(roles)
      .values({ name: preset.name, slug: preset.slug, description: preset.description, permissions: preset.permissions, isSystem: true })
      .onConflictDoNothing();
  }
  const roleRows = await db.select().from(roles);
  const roleId = (slug: string) => roleRows.find((r) => r.slug === slug)?.id ?? null;

  /* --------------------------------------------------------------- admins */
  const adminSeed = [
    { name: "Ravenous Owner", email: "admin@ravenous.local", password: "Admin@12345", role: "super-admin", super: true },
    { name: "Restaurant Manager", email: "manager@ravenous.local", password: "Manager@12345", role: "manager", super: false },
    { name: "Kitchen Staff", email: "staff@ravenous.local", password: "Staff@12345", role: "staff", super: false },
    { name: "Delivery Partner", email: "driver@ravenous.local", password: "Driver@12345", role: "delivery-staff", super: false },
  ];
  for (const admin of adminSeed) {
    await db
      .insert(adminUsers)
      .values({
        name: admin.name,
        email: admin.email,
        passwordHash: await hashPassword(admin.password),
        roleId: roleId(admin.role),
        isSuperAdmin: admin.super,
        status: "active",
      })
      .onConflictDoNothing();
  }

  /* ------------------------------------------------------------- settings */
  await db
    .insert(restaurantSettings)
    .values({
      id: 1,
      name: "Ravenous Multi Cuisine Restaurant",
      shortName: "Ravenous",
      tagline: "Multi Cuisine Restaurant",
      brandMessage: "Good Food. Great Vibes. Made for Every Craving.",
      brandSubtext:
        "Discover delicious multi-cuisine favourites, freshly prepared and delivered to your doorstep—or enjoy them at Ravenous.",
      addressLine: "Ring Road No-2, Gaurav Path, Kalindi Kunj, Jarahbhata",
      city: "Bilaspur",
      state: "Chhattisgarh",
      pincode: "495001",
      country: "India",
      phone: "093039 73399",
      whatsapp: "919303973399",
      email: "hello@ravenous.example",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Ravenous+Multi+Cuisine+Restaurant+Ring+Road+No-2+Bilaspur",
      latitude: "22.0849",
      longitude: "82.1514",
      priceRange: "₹200–₹1,200 per person",
      publicRating: "4.5",
      publicReviewCount: 1129,
      services: "Dine-in, Delivery, Drive-through",
      heroImageUrl: IMAGES.hero,
      aboutImageUrl: IMAGES.interior,
      status: "open",
      hours: DEFAULT_HOURS,
      social: { instagram: "https://instagram.com", facebook: "https://facebook.com" },
      delivery: DEFAULT_DELIVERY,
      tax: DEFAULT_TAX,
      payment: DEFAULT_PAYMENT,
      reservation: DEFAULT_RESERVATION,
      ordering: DEFAULT_ORDERING,
      gstNumber: "",
      fssaiNumber: "",
    })
    .onConflictDoNothing();

  /* ---------------------------------------------------------- homepage cms */
  const sections = [
    { key: "hero", title: "Good Food. Great Vibes. Made for Every Craving.", subtitle: "Ravenous Multi Cuisine Restaurant, Bilaspur", body: "Explore Ravenous Multi Cuisine Restaurant and order your favourites online.", imageUrl: IMAGES.hero, ctaLabel: "Order Now", ctaHref: "/menu", secondaryCtaLabel: "Explore Menu", secondaryCtaHref: "/menu", position: 1 },
    { key: "categories", title: "What are you craving today?", subtitle: "Quick order categories", body: "Jump straight into the section you are hungry for.", imageUrl: IMAGES.rice, position: 2 },
    { key: "popular", title: "Ravenous favourites", subtitle: "Bestsellers & popular picks", body: "Demo menu data — the kitchen team can replace every dish, price and photo from the admin dashboard.", imageUrl: IMAGES.biryani, ctaLabel: "View full menu", ctaHref: "/menu", position: 3 },
    { key: "offers", title: "Offers & happy hours", subtitle: "Save on your next craving", body: "Coupons and time-based promotions configured by the restaurant.", imageUrl: IMAGES.chinese, ctaLabel: "See all offers", ctaHref: "/offers", position: 4 },
    { key: "story", title: "The Ravenous story", subtitle: "A welcoming multi-cuisine destination", body: "Ravenous Multi Cuisine Restaurant brings together a wide variety of flavours in one welcoming destination in Bilaspur.", imageUrl: IMAGES.interior, ctaLabel: "More about us", ctaHref: "/about", position: 5 },
    { key: "gallery", title: "Inside Ravenous", subtitle: "Food, drinks and the vibe", body: "A look at our kitchen, dining spaces and plates.", imageUrl: IMAGES.exterior, ctaLabel: "Open gallery", ctaHref: "/gallery", position: 6 },
    { key: "reviews", title: "Loved by Bilaspur", subtitle: "Public rating reference: 4.5★", body: "Public review count reference: 1,129. Independent third-party rating data, shown for reference only.", imageUrl: IMAGES.dessert, position: 7 },
    { key: "location", title: "Find us in Bilaspur", subtitle: "Ring Road No-2, Gaurav Path, Kalindi Kunj, Jarahbhata", body: "Dine-in · Delivery · Drive-through", imageUrl: IMAGES.exterior, ctaLabel: "Get directions", ctaHref: "/contact", position: 8 },
    { key: "final-cta", title: "Hungry already?", subtitle: "Order in a few taps", body: "Freshly prepared multi-cuisine food, delivered in Bilaspur or served at your table.", imageUrl: IMAGES.hero, ctaLabel: "Order Now", ctaHref: "/menu", secondaryCtaLabel: "Book a Table", secondaryCtaHref: "/reservations", position: 9 },
  ];
  for (const section of sections) {
    await db.insert(homepageSections).values(section).onConflictDoNothing();
  }

  /* --------------------------------------------------------- legal pages */
  const legal = [
    { slug: "privacy-policy", title: "Privacy Policy", content: "Ravenous collects only the information needed to take, prepare and deliver your order — your name, phone number, delivery address and email. Order data is stored securely and is never sold. Payment details are handled by our payment partner and are never stored on our servers. You may request deletion of your account data by contacting the restaurant." },
    { slug: "terms-conditions", title: "Terms & Conditions", content: "By placing an order with Ravenous you confirm that the details you provide are accurate and that you are authorised to use the selected payment method. Menu availability, prices and delivery charges are set by the restaurant and may change without notice. All orders are confirmed only after the restaurant accepts them." },
    { slug: "refund-policy", title: "Refund Policy", content: "If an order cannot be fulfilled, prepaid amounts are refunded to the original payment method. Refunds are shown as Pending until the restaurant initiates them and completed only after the payment partner confirms the refund. Cash on delivery orders are refunded in cash or store credit at the restaurant's discretion." },
    { slug: "cancellation-policy", title: "Cancellation Policy", content: "Orders can be cancelled from your account within the cancellation window configured by the restaurant (default 10 minutes) or until preparation begins. Once the kitchen has started preparing your food, cancellation may no longer be available. The restaurant may also cancel an order and any prepaid amount will be refunded." },
    { slug: "delivery-policy", title: "Delivery Policy", content: "Delivery is available inside the configured service radius around the restaurant in Bilaspur. Delivery charges are calculated once per order based on distance slabs, with free delivery above the configured order value. Orders outside the service radius can be placed as pickup or dine-in." },
    { slug: "reservation-policy", title: "Reservation Policy", content: "Table reservations are confirmed subject to availability and restaurant approval. Please arrive within 15 minutes of your reserved slot. Reservations may be cancelled from your account or by calling the restaurant." },
  ];
  for (const page of legal) {
    await db.insert(legalPages).values(page).onConflictDoNothing();
  }

  /* ---------------------------------------------------------------- media */
  const mediaSeed = [
    { url: IMAGES.hero, title: "Ravenous signature platter", alt: "Multi cuisine platter at Ravenous", category: "food", section: "Homepage Hero", order: 1 },
    { url: IMAGES.biryani, title: "Dum biryani", alt: "Chicken dum biryani bowl", category: "food", section: "Featured Food", order: 2 },
    { url: IMAGES.rice, title: "Fried rice", alt: "Veg fried rice bowl", category: "food", section: "Menu Item", order: 3 },
    { url: IMAGES.chinese, title: "Chilli paneer", alt: "Chilli paneer dry starter", category: "food", section: "Menu Item", order: 4 },
    { url: IMAGES.indian, title: "Paneer butter masala", alt: "Paneer butter masala with naan", category: "food", section: "Menu Item", order: 5 },
    { url: IMAGES.noodles, title: "Hakka noodles", alt: "Hakka noodles with vegetables", category: "food", section: "Menu Item", order: 6 },
    { url: IMAGES.drinks, title: "Juices and mocktails", alt: "Fresh juices and mocktails", category: "drinks", section: "Menu Item", order: 7 },
    { url: IMAGES.dessert, title: "Desserts", alt: "Gulab jamun and lava cake", category: "food", section: "Gallery", order: 8 },
    { url: IMAGES.interior, title: "Dining hall", alt: "Ravenous dining hall interior", category: "interior", section: "About", order: 9 },
    { url: IMAGES.exterior, title: "Restaurant exterior", alt: "Ravenous restaurant exterior in the evening", category: "exterior", section: "Gallery", order: 10 },
  ];
  for (const row of mediaSeed) {
    await db.insert(media).values({ url: row.url, title: row.title, altText: row.alt, category: row.category, section: row.section, sortOrder: row.order, mimeType: "image/jpeg" });
  }

  /* ----------------------------------------------------------- categories */
  for (const [index, cat] of CATEGORY_SEED.entries()) {
    await db
      .insert(categories)
      .values({
        name: cat.name,
        slug: slugify(cat.name),
        description: cat.description,
        imageUrl: cat.image,
        prepTimeMinutes: cat.prep,
        sortOrder: index + 1,
        isActive: true,
        seoTitle: `${cat.name} in Bilaspur | Ravenous Multi Cuisine Restaurant`,
        seoDescription: cat.description,
      })
      .onConflictDoNothing();
  }
  const categoryRows = await db.select().from(categories);
  const categoryId = (name: string) => categoryRows.find((c) => c.name === name)?.id ?? null;

  /* ------------------------------------------------------------- add-ons */
  for (const [index, addon] of ADDON_SEED.entries()) {
    await db
      .insert(addons)
      .values({ name: addon.name, price: addon.price, groupLabel: addon.group, isActive: true, isAvailable: true, sortOrder: index + 1 });
  }
  const addonRows = await db.select().from(addons);

  /* ----------------------------------------------------------- menu items */
  let itemIndex = 0;
  const itemIdBySlug = new Map<string, number>();
  for (const item of MENU_SEED) {
    itemIndex += 1;
    const slug = slugify(item.name);
    const [inserted] = await db
      .insert(menuItems)
      .values({
        name: item.name,
        slug,
        categoryId: categoryId(item.category),
        cuisine: item.cuisine,
        description: item.desc,
        shortDescription: item.desc,
        ingredients: item.ingredients,
        allergens: item.allergens ?? null,
        imageUrl: item.image,
        gallery: [item.image, IMAGES.hero],
        basePrice: item.price,
        mrp: item.mrp ?? item.price,
        taxRate: DEFAULT_TAX.defaultRate,
        foodType: item.foodType ?? "veg",
        isJain: false,
        spiceLevel: item.spicy ?? "medium",
        servingSize: item.serving ?? "1 serving",
        prepTimeMinutes: item.prep ?? 20,
        isAvailable: true,
        isFeatured: Boolean(item.featured),
        isBestseller: Boolean(item.bestseller),
        isPopular: Boolean(item.popular),
        isNew: Boolean(item.isNew),
        isRecommended: Boolean(item.recommended),
        hasCustomization: Boolean(item.customize),
        tags: item.tags ?? "",
        seoTitle: `${item.name} — Ravenous Bilaspur (Demo Menu Item)`,
        seoDescription: item.desc,
        isDemoData: true,
        sortOrder: itemIndex,
        ratingAvg: item.bestseller ? 48 : 45,
        ratingCount: item.bestseller ? 24 : 9,
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted) continue;
    itemIdBySlug.set(slug, inserted.id);

    if (item.variants?.length) {
      await db.insert(menuVariants).values(
        item.variants.map((variant, i) => ({
          menuItemId: inserted.id,
          name: variant.name,
          price: variant.price,
          mrp: variant.mrp ?? variant.price,
          isDefault: Boolean(variant.def),
          isAvailable: true,
          stock: -1,
          prepTimeMinutes: item.prep ?? 20,
          sortOrder: i + 1,
        })),
      );
    }

    if (item.customize) {
      const links = addonRows
        .filter((a) => ["Extra Cheese", "Extra Paneer", "Extra Chicken", "Extra Sauce", "Extra Vegetables", "Extra Gravy", "Jain Preparation (No Onion/Garlic)"].includes(a.name))
        .map((a) => ({ menuItemId: inserted.id, addonId: a.id }));
      if (links.length) await db.insert(menuItemAddons).values(links).onConflictDoNothing();
    }
    const sideLinks = addonRows
      .filter((a) => ["Raita", "Masala Papad", "Soft Drink", "Butter Naan"].includes(a.name))
      .map((a) => ({ menuItemId: inserted.id, addonId: a.id }));
    await db.insert(menuItemAddons).values(sideLinks).onConflictDoNothing();
  }

  /* ----------------------------------------------------------- inventory */
  for (const inv of INVENTORY_SEED) {
    await db.insert(inventoryItems).values({
      name: inv.name,
      unit: inv.unit,
      currentStock: inv.stock,
      lowStockThreshold: inv.low,
      costPerUnit: inv.cost,
      supplier: inv.supplier,
      isActive: true,
    });
  }

  /* ------------------------------------------------------ delivery zones */
  for (const [index, zone] of ZONE_SEED.entries()) {
    await db.insert(deliveryZones).values({
      name: zone.name,
      minKm: zone.min,
      maxKm: zone.max,
      fee: zone.fee,
      minOrder: zone.minOrder,
      extraPerKm: zone.extra,
      pincodes: zone.pincodes,
      isActive: true,
      sortOrder: index + 1,
    });
  }

  /* -------------------------------------------------------------- tables */
  for (let i = 1; i <= 16; i += 1) {
    const section = i <= 8 ? "Ground Floor" : i <= 12 ? "AC Hall" : "Terrace";
    await db
      .insert(restaurantTables)
      .values({
        tableNumber: `T${i}`,
        code: `RV-T${String(i).padStart(2, "0")}`,
        capacity: i <= 8 ? 4 : i <= 12 ? 6 : 8,
        section,
        status: "available",
        isActive: true,
      })
      .onConflictDoNothing();
  }

  /* ------------------------------------------------------------- coupons */
  const couponSeed = [
    { name: "Welcome 10% off", code: "WELCOME10", type: "percent", value: 10, min: 29900, max: 10000, limit: 500, perUser: 1 },
    { name: "Flat ₹50 off", code: "RAVENOUS50", type: "fixed", value: 5000, min: 39900, max: 5000, limit: 300, perUser: 2 },
    { name: "Free delivery", code: "FREEDEL", type: "free_delivery", value: 0, min: 49900, max: 0, limit: 0, perUser: 3, orderTypes: "delivery" },
    { name: "Happy Hours 20% off", code: "HAPPY20", type: "percent", value: 20, min: 24900, max: 15000, limit: 0, perUser: 2, startTime: "16:00", endTime: "18:00" },
    { name: "First order 15% off", code: "FIRST15", type: "percent", value: 15, min: 19900, max: 12000, limit: 0, perUser: 1, firstOrder: true },
  ];
  for (const coupon of couponSeed) {
    await db
      .insert(coupons)
      .values({
        name: coupon.name,
        code: coupon.code,
        discountType: coupon.type,
        discountValue: coupon.value,
        minOrder: coupon.min,
        maxDiscount: coupon.max,
        usageLimit: coupon.limit,
        perUserLimit: coupon.perUser,
        firstOrderOnly: Boolean(coupon.firstOrder),
        startTime: coupon.startTime ?? null,
        endTime: coupon.endTime ?? null,
        orderTypes: coupon.orderTypes ?? "delivery,pickup,dinein",
        isActive: true,
        isDemoData: true,
      })
      .onConflictDoNothing();
  }

  /* ------------------------------------------------------------ customers */
  const customerSeed = [
    { name: "Demo Customer", email: "customer@ravenous.local", phone: "9303900001", password: "Customer@12345" },
    { name: "Priya Sharma", email: "priya@example.com", phone: "9303900002", password: "Customer@12345" },
    { name: "Amit Patel", email: "amit@example.com", phone: "9303900003", password: "Customer@12345" },
  ];
  for (const customer of customerSeed) {
    await db
      .insert(users)
      .values({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        passwordHash: await hashPassword(customer.password),
        status: "active",
        emailVerified: true,
      })
      .onConflictDoNothing();
  }
  const userRows = await db.select().from(users);
  const demoUser = userRows.find((u) => u.email === "customer@ravenous.local");

  /* ------------------------------------------------------------ favorites */
  if (demoUser) {
    const favSlugs = ["hyderabadi-chicken-dum-biryani", "paneer-butter-masala", "virgin-mojito"];
    for (const slug of favSlugs) {
      const id = itemIdBySlug.get(slug);
      if (id) await db.insert(favorites).values({ userId: demoUser.id, menuItemId: id }).onConflictDoNothing();
    }
  }

  /* --------------------------------------------------------------- reviews */
  const reviewSeed = [
    { item: "hyderabadi-chicken-dum-biryani", name: "Demo Customer", rating: 5, comment: "Biryani was aromatic and the raita portion was generous. (DEMO DATA)" },
    { item: "paneer-butter-masala", name: "Priya Sharma", rating: 4, comment: "Creamy gravy, good with butter naan. (DEMO DATA)" },
    { item: "veg-hakka-noodles", name: "Amit Patel", rating: 4, comment: "Fresh and light, not oily. (DEMO DATA)" },
    { item: "virgin-mojito", name: "Demo Customer", rating: 5, comment: "Perfectly chilled, very refreshing. (DEMO DATA)" },
    { item: "fried-rice", name: "Priya Sharma", rating: 5, comment: "Portion size was good for two. (DEMO DATA)" },
    { item: "chocolate-lava-cake", name: "Amit Patel", rating: 4, comment: "Warm and gooey, ideal dessert. (DEMO DATA)" },
  ];
  for (const review of reviewSeed) {
    const itemId = itemIdBySlug.get(review.item);
    await db.insert(reviews).values({
      menuItemId: itemId ?? null,
      customerName: review.name,
      rating: review.rating,
      comment: review.comment,
      status: "approved",
      isVerified: false,
      isDemoData: true,
      adminResponse: null,
    });
  }

  /* ---------------------------------------------------------- reservations */
  const reservationSeed = [
    { name: "Priya Sharma", phone: "9303900002", date: offsetDate(1), time: "20:00", guests: 4, status: "confirmed", request: "Corner table if available" },
    { name: "Amit Patel", phone: "9303900003", date: offsetDate(2), time: "13:30", guests: 2, status: "requested", request: "Jain options please" },
    { name: "Demo Customer", phone: "9303900001", date: offsetDate(-2), time: "19:30", guests: 6, status: "completed", request: "Birthday cake cutting" },
  ];
  for (const [index, reservation] of reservationSeed.entries()) {
    await db.insert(reservations).values({
      code: `RSV-${String(1001 + index)}`,
      userId: demoUser?.id ?? null,
      name: reservation.name,
      phone: reservation.phone,
      date: reservation.date,
      time: reservation.time,
      guests: reservation.guests,
      specialRequest: reservation.request,
      status: reservation.status,
    });
  }

  /* -------------------------------------------------------- demo orders */
  const demoOrders = [
    { status: "placed", type: "delivery", minutesAgo: 4, items: [{ slug: "hyderabadi-chicken-dum-biryani", qty: 1, variant: false }, { slug: "butter-naan", qty: 2 }], payment: "cod", name: "Demo Customer", phone: "9303900001" },
    { status: "accepted", type: "delivery", minutesAgo: 12, items: [{ slug: "paneer-butter-masala", qty: 1 }, { slug: "garlic-naan", qty: 2 }], payment: "upi", name: "Priya Sharma", phone: "9303900002" },
    { status: "preparing", type: "delivery", minutesAgo: 22, items: [{ slug: "schezwan-chicken-noodles", qty: 2 }, { slug: "chilli-paneer-dry", qty: 1 }], payment: "upi", name: "Amit Patel", phone: "9303900003" },
    { status: "ready", type: "pickup", minutesAgo: 34, items: [{ slug: "schezwan-veg-fried-rice", qty: 2 }], payment: "counter", name: "Demo Customer", phone: "9303900001" },
    { status: "out_for_delivery", type: "delivery", minutesAgo: 46, items: [{ slug: "chicken-tikka-pizza", qty: 1 }], payment: "cod", name: "Priya Sharma", phone: "9303900002" },
    { status: "delivered", type: "delivery", minutesAgo: 150, items: [{ slug: "biryani-combo-meal", qty: 1 }, { slug: "virgin-mojito", qty: 2 }], payment: "upi", name: "Amit Patel", phone: "9303900003" },
    { status: "served", type: "dinein", minutesAgo: 58, items: [{ slug: "kadai-chicken", qty: 1 }, { slug: "butter-naan", qty: 4 }], payment: "counter", name: "Walk-in Guest", phone: "9303999999", table: "RV-T04" },
  ];

  const tableRows = await db.select().from(restaurantTables);
  for (const [index, demo] of demoOrders.entries()) {
    const code = `RV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(9001 + index)}`;
    const createdAt = new Date(Date.now() - demo.minutesAgo * 60000);
    let subtotal = 0;
    const lines: { item: typeof menuItems.$inferSelect; qty: number }[] = [];
    for (const line of demo.items) {
      const item = await db.select().from(menuItems).where(eq(menuItems.slug, line.slug)).limit(1);
      if (!item[0]) continue;
      lines.push({ item: item[0], qty: line.qty });
      subtotal += item[0].basePrice * line.qty;
    }
    const tax = Math.round(subtotal * 0.05);
    const deliveryFee = demo.type === "delivery" ? 3000 : 0;
    const packaging = 1500;
    const total = subtotal + tax + deliveryFee + packaging;
    const [order] = await db
      .insert(orders)
      .values({
        orderCode: code,
        userId: demoUser?.id ?? null,
        customerName: demo.name,
        customerPhone: demo.phone,
        customerEmail: null,
        orderType: demo.type,
        status: demo.status,
        paymentStatus: demo.payment === "cod" ? (demo.status === "delivered" ? "cod_collected" : "cod_pending") : demo.payment === "upi" ? "paid" : "pay_at_restaurant",
        paymentMethod: demo.payment,
        addressSnapshot:
          demo.type === "delivery"
            ? { label: "Home", fullName: demo.name, phone: demo.phone, house: "12-B", street: "Gaurav Path", locality: "Kalindi Kunj", city: "Bilaspur", state: "Chhattisgarh", pincode: "495001" }
            : null,
        distanceKm: demo.type === "delivery" ? 240 : 0,
        deliveryFee,
        packagingFee: packaging,
        subtotal,
        discountTotal: 0,
        taxTotal: tax,
        total,
        itemCount: lines.reduce((sum, l) => sum + l.qty, 0),
        tableCode: demo.table ?? null,
        tableId: demo.table ? tableRows.find((t) => t.code === demo.table)?.id ?? null : null,
        prepTimeMinutes: 25,
        etaMinutes: 40,
        isDemoData: true,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    for (const line of lines) {
      await db.insert(orderItems).values({
        orderId: order.id,
        menuItemId: line.item.id,
        name: line.item.name,
        foodType: line.item.foodType,
        unitPrice: line.item.basePrice,
        mrp: line.item.mrp,
        quantity: line.qty,
        taxRate: 5,
        taxAmount: Math.round((line.item.basePrice * line.qty * 5) / 100),
        lineTotal: line.item.basePrice * line.qty,
        createdAt,
      });
    }
    const historyStatuses = demo.status === "placed" ? ["placed"] : ["placed", "accepted", demo.status];
    for (const status of [...new Set(historyStatuses)]) {
      await db.insert(orderStatusHistory).values({ orderId: order.id, status, actorType: "system", createdAt });
    }
  }

  /* -------------------------------------------------------- notifications */
  await db.insert(notifications).values([
    { audience: "admin", type: "order", title: "New order received", body: "A demo order is waiting in the kitchen queue.", link: "/admin/kitchen" },
    { audience: "admin", type: "inventory", title: "Low stock alert", body: "Fresh Cream is below the configured threshold.", link: "/admin/inventory" },
    { audience: "admin", type: "review", title: "New review submitted", body: "A demo review is awaiting moderation.", link: "/admin/reviews" },
  ]);

  return { seeded: true };
}

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

let seedPromise: Promise<{ seeded: boolean; reason?: string }> | null = null;

export async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seedDatabase(false).catch((error) => {
      console.error("seed failed", error);
      seedPromise = null;
      return { seeded: false, reason: "error" };
    });
  }
  return seedPromise;
}
