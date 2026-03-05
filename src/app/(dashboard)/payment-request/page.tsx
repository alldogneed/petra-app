"use client";

import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Minus,
  X,
  Send,
  User,
  ShoppingBag,
  Percent,
  Calculator,
  MessageCircle,
  Link as LinkIcon,
  ExternalLink,
  CreditCard,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, toWhatsAppPhone, fetchJSON } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  price: number;
  paymentUrl: string;
  category: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

// ─── Component ────────────────────────────────────────────────────

export default function PaymentRequestPage() {
  const searchParams = useSearchParams();
  const prefilledCustomerId = searchParams.get("customerId");
  const prefilledName = searchParams.get("name");
  const prefilledPhone = searchParams.get("phone");

  // Customer search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => {
    // Instant prefill from URL params — no async fetch needed
    if (prefilledCustomerId && prefilledName && prefilledPhone) {
      return { id: prefilledCustomerId, name: prefilledName, phone: prefilledPhone };
    }
    return null;
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Products from DB
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["price-list-items"],
    queryFn: async () => {
      const data = await fetchJSON("/api/price-list-items") as Array<{ id: string; name: string; basePrice: number; category: string | null; paymentUrl: string | null }>;
      return data.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.basePrice,
        paymentUrl: item.paymentUrl || "",
        category: item.category || "כללי",
      }));
    },
  });

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category))].sort();
    return ["הכל", ...cats];
  }, [products]);

  // Selected items & discount
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [activeCategory, setActiveCategory] = useState("הכל");

  // Discount & manual override
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [manualPrice, setManualPrice] = useState(0);

  // Payment URL — auto-filled from first selected product that has one, overridable by user
  const [customPaymentUrl, setCustomPaymentUrl] = useState("");

  // Stripe payment link — generated on demand
  const [stripeLink, setStripeLink] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  // Customer search query
  const { data: searchResults = [] } = useQuery<Customer[]>({
    queryKey: ["customer-search", searchQuery],
    queryFn: () => fetchJSON(`/api/customers?search=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length >= 2 && !selectedCustomer,
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show dropdown when results arrive
  useEffect(() => {
    if (searchResults.length > 0 && searchQuery.length >= 2 && !selectedCustomer) {
      setShowDropdown(true);
    }
  }, [searchResults, searchQuery, selectedCustomer]);

  // ─── Calculations ────────────────────────────────────────────

  const subtotal = useMemo(() => {
    let total = 0;
    selectedItems.forEach((qty, productId) => {
      const product = products.find((p) => p.id === productId);
      if (product) total += product.price * qty;
    });
    return total;
  }, [selectedItems, products]);

  const discountAmount = useMemo(
    () => Math.round(subtotal * (discountPercent / 100)),
    [subtotal, discountPercent]
  );

  const calculatedTotal = useMemo(
    () => subtotal - discountAmount,
    [subtotal, discountAmount]
  );

  const finalPrice = isManualOverride ? manualPrice : calculatedTotal;

  // ─── Product helpers ─────────────────────────────────────────

  const filteredProducts =
    activeCategory === "הכל"
      ? products
      : products.filter((p) => p.category === activeCategory);

  function addItem(productId: string) {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      next.set(productId, (next.get(productId) || 0) + 1);
      return next;
    });
  }

  function removeItem(productId: string) {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      const qty = next.get(productId) || 0;
      if (qty <= 1) {
        next.delete(productId);
      } else {
        next.set(productId, qty - 1);
      }
      return next;
    });
  }

  function clearItem(productId: string) {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  }

  // ─── Stripe payment link ─────────────────────────────────────

  async function generateStripeLink() {
    if (!canSend) return;
    setStripeLoading(true);
    try {
      const itemNames = selectedProductsList
        .map(({ product, qty }) => `${product.name}${qty > 1 ? ` x${qty}` : ""}`)
        .join(", ");

      const res = await fetch("/api/payments/stripe/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalPrice,
          description: itemNames || "תשלום",
          customerId: selectedCustomer?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "שגיאה ביצירת קישור Stripe");
        return;
      }

      setStripeLink(data.url);
      setCustomPaymentUrl(data.url);
      toast.success("קישור Stripe נוצר!");
    } catch {
      toast.error("שגיאת רשת — נסה שוב");
    } finally {
      setStripeLoading(false);
    }
  }

  // ─── WhatsApp message ────────────────────────────────────────

  const selectedProductsList = useMemo(() => {
    const items: { product: Product; qty: number }[] = [];
    selectedItems.forEach((qty, productId) => {
      const product = products.find((p) => p.id === productId);
      if (product) items.push({ product, qty });
    });
    return items;
  }, [selectedItems, products]);

  // Auto-fill payment URL from first selected product that has one
  const autoPaymentUrl = useMemo(() => {
    for (const { product } of selectedProductsList) {
      if (product.paymentUrl) return product.paymentUrl;
    }
    return "";
  }, [selectedProductsList]);

  // Effective URL: custom override takes priority, else auto from product
  const effectivePaymentUrl = customPaymentUrl.trim() || autoPaymentUrl;

  // Sync auto URL into the input when products change (only if user hasn't typed their own)
  useEffect(() => {
    if (!customPaymentUrl) {
      // no-op: we show autoPaymentUrl as placeholder
    }
  }, [autoPaymentUrl, customPaymentUrl]);

  function buildWhatsAppUrl(): string {
    if (!selectedCustomer) return "#";

    const phone = toWhatsAppPhone(selectedCustomer.phone);

    const itemLines = selectedProductsList
      .map(({ product, qty }) => `• ${product.name} x${qty} - ₪${product.price * qty}`)
      .join("\n");

    let message = `שלום ${selectedCustomer.name},\nהנה פירוט ההזמנה שלך:\n${itemLines}`;

    if (discountPercent > 0) {
      message += `\nהנחה: ${discountPercent}%`;
    }

    message += `\n\nסה"כ לתשלום: ₪${finalPrice}`;

    if (effectivePaymentUrl) {
      message += `\n\nלתשלום: ${effectivePaymentUrl}`;
    }

    return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
  }

  const canSend = selectedCustomer && selectedItems.size > 0 && finalPrice > 0;

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <FinanceTabs />
      {/* WhatsApp Banner */}
      {canSend && (
        <a
          href={buildWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-green-500 hover:bg-green-600 text-white rounded-2xl p-4 transition-colors shadow-md"
        >
          <div className="flex items-center justify-center gap-3">
            <MessageCircle className="w-6 h-6" />
            <span className="text-lg font-semibold">
              שלח בקשת תשלום בוואטסאפ — ₪{finalPrice}
            </span>
            <Send className="w-5 h-5" />
          </div>
        </a>
      )}

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-petra-text">בקשת תשלום</h1>
        <p className="text-sm text-slate-500 mt-1">בחר לקוח, הוסף מוצרים ושלח בקשת תשלום בוואטסאפ</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-petra-text">בחירת לקוח</h2>
            </div>

            {selectedCustomer ? (
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-petra-text">{selectedCustomer.name}</p>
                  <p className="text-sm text-slate-500">{selectedCustomer.phone}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setSearchQuery("");
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            ) : (
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="חפש לקוח לפי שם או טלפון..."
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((customer: Customer) => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowDropdown(false);
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-right"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-petra-text">
                            {customer.name}
                          </p>
                          <p className="text-xs text-slate-500">{customer.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Products Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="w-5 h-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-petra-text">מוצרים ושירותים</h2>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm transition-colors",
                    activeCategory === cat
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            {productsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4 animate-pulse h-24" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">אין פריטים במחירון</p>
                <p className="text-xs text-slate-300 mt-1">הוסף פריטים בהגדרות → מחירון</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map((product) => {
                const qty = selectedItems.get(product.id) || 0;
                return (
                  <div
                    key={product.id}
                    className={cn(
                      "rounded-xl border p-4 transition-all",
                      qty > 0
                        ? "border-orange-300 bg-orange-50/50"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-petra-text">{product.name}</p>
                        <span className="text-xs text-slate-500">{product.category}</span>
                      </div>
                      <span className="text-sm font-semibold text-petra-text">
                        ₪{product.price}
                      </span>
                    </div>

                    {qty > 0 ? (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => removeItem(product.id)}
                          className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                        <button
                          onClick={() => addItem(product.id)}
                          className="w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => clearItem(product.id)}
                          className="ms-auto p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addItem(product.id)}
                        className="mt-3 w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        הוסף
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>

        {/* Right Column (1/3) — Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-lg p-5 sticky top-6">
            <div className="flex items-center gap-2 mb-5">
              <Calculator className="w-5 h-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-petra-text">סיכום הזמנה</h2>
            </div>

            {selectedProductsList.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">לא נבחרו מוצרים</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Items */}
                <div className="space-y-2">
                  {selectedProductsList.map(({ product, qty }) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-petra-text">
                        {product.name}{" "}
                        {qty > 1 && (
                          <span className="text-slate-500">x{qty}</span>
                        )}
                      </span>
                      <span className="font-medium text-petra-text">
                        ₪{product.price * qty}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 pt-3 space-y-3">
                  {/* Subtotal */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">סכום ביניים</span>
                    <span className="text-petra-text">₪{subtotal}</span>
                  </div>

                  {/* Discount */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-500">הנחה</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={discountPercent || ""}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, Number(e.target.value)));
                          setDiscountPercent(val);
                        }}
                        placeholder="0"
                        className="w-20 px-3 py-1.5 rounded-xl border border-petra-border text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                      />
                      <span className="text-sm text-slate-500">%</span>
                      {discountAmount > 0 && (
                        <span className="text-sm text-green-600 ms-auto">
                          -₪{discountAmount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Calculated Total */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">סה&quot;כ אחרי הנחה</span>
                    <span className="text-petra-text">₪{calculatedTotal}</span>
                  </div>

                  {/* Manual Override */}
                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isManualOverride}
                        onChange={(e) => {
                          setIsManualOverride(e.target.checked);
                          if (e.target.checked) setManualPrice(calculatedTotal);
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-600">עריכה ידנית של המחיר</span>
                    </label>
                    {isManualOverride && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">₪</span>
                        <input
                          type="number"
                          min={0}
                          value={manualPrice || ""}
                          onChange={(e) => setManualPrice(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Final Price */}
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-petra-text">סה&quot;כ לתשלום</span>
                    <span className="text-xl font-bold text-orange-600">₪{finalPrice}</span>
                  </div>
                </div>

                {/* Payment URL */}
                <div className="border-t border-slate-200 pt-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-500">קישור לתשלום</span>
                    {effectivePaymentUrl && (
                      <a
                        href={effectivePaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ms-auto"
                      >
                        <ExternalLink className="w-3 h-3 text-blue-400 hover:text-blue-600" />
                      </a>
                    )}
                  </div>
                  {/* Stripe generate button */}
                  {canSend && (
                    <button
                      onClick={generateStripeLink}
                      disabled={stripeLoading}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium transition-colors disabled:opacity-60"
                    >
                      {stripeLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5" />
                      )}
                      {stripeLoading ? "יוצר קישור Stripe..." : `צור קישור Stripe — ₪${finalPrice}`}
                    </button>
                  )}
                  <input
                    type="url"
                    value={customPaymentUrl}
                    onChange={(e) => {
                      setCustomPaymentUrl(e.target.value);
                      if (stripeLink && e.target.value !== stripeLink) setStripeLink(null);
                    }}
                    placeholder={autoPaymentUrl || "הדבק קישור לדף תשלום..."}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 placeholder:text-slate-300"
                  />
                  {stripeLink && customPaymentUrl === stripeLink && (
                    <p className="text-xs text-violet-600 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      קישור Stripe נוצר — ישלח בהודעה
                    </p>
                  )}
                  {!customPaymentUrl && autoPaymentUrl && (
                    <p className="text-xs text-slate-400">
                      ↑ קישור אוטומטי מהמוצר הנבחר
                    </p>
                  )}
                  {!effectivePaymentUrl && (
                    <p className="text-xs text-amber-500">
                      ללא קישור — ההודעה תישלח ללא לינק תשלום
                    </p>
                  )}
                </div>

                {/* WhatsApp Send Button */}
                {canSend ? (
                  <a
                    href={buildWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-center text-sm font-semibold transition-colors"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      שלח בוואטסאפ
                    </span>
                  </a>
                ) : (
                  <div className="py-3 rounded-xl bg-slate-100 text-slate-400 text-center text-sm">
                    {!selectedCustomer ? "בחר לקוח כדי לשלוח" : "הוסף מוצרים כדי לשלוח"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
