"use client";

import React, { useState, useEffect } from "react";
import { Clipboard, ArrowRight, Save } from "lucide-react";
import { OrderData, OrderStatus } from "./types/order";
import { updateOrderStatus, getOrderById } from "./action"; // Import your secure server actions

interface TrackOrderViewProps {
  initialOrderId?: string;
}

export default function WarehouseDashboard({
  initialOrderId = "",
}: TrackOrderViewProps) {
  const [orderId, setOrderId] = useState<string>(initialOrderId);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  
  // Track backend document ID and internal dropdown status selection
  const [docId, setDocId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>("confirmed");
  const [updating, setUpdating] = useState<boolean>(false);

  useEffect(() => {
    if (initialOrderId) {
      fetchLiveDetails(initialOrderId);
    }
  }, [initialOrderId]);

  const fetchLiveDetails = async (targetId: string) => {
    if (!targetId || targetId === "ZV-") return;
    setLoading(true);
    setError(null);
    setOrderData(null);

    try {
      const result = await getOrderById(targetId);

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch order.");
      }

      const order = result.data;

      if (order) {
        setDocId(order._id); // Capture raw _id safely for patches

        const mappedItems = Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              id: item._key || item._id || item.id || Math.random().toString(),
              name: item.productName || item.name || "Unnamed Product",
              price: typeof item.priceSnapshot === "number" ? item.priceSnapshot : typeof item.price === "number" ? item.price : 0,
              qty: typeof item.quantity === "number" ? item.quantity : typeof item.qty === "number" ? item.qty : 1,
              image: item.productImage || item.image || "/placeholder-product.png",
              specs: item.specs || "",
            }))
          : [];

        let formattedPurchaseDate = "N/A";
        let formattedExpectedDate = "N/A";
        try {
          const purchaseDateRaw = order.createdAt || order.purchaseDate || order._createdAt;
          if (purchaseDateRaw) {
            const pDate = new Date(purchaseDateRaw);
            if (!isNaN(pDate.getTime())) {
              formattedPurchaseDate = pDate.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              });

              const expDateRaw = order.expectedDate;
              if (expDateRaw) {
                const eDate = new Date(expDateRaw);
                if (!isNaN(eDate.getTime())) {
                  formattedExpectedDate = eDate.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });
                }
              }

              if (formattedExpectedDate === "N/A") {
                const eDate = new Date(pDate.getTime() + 5 * 24 * 60 * 60 * 1000);
                formattedExpectedDate = eDate.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
              }
            }
          }
        } catch (e) {
          console.error("Error formatting order dates", e);
        }

        const shippingAddrObj = {
          name: order.customerName || "Valued Customer",
          phone: order.customerPhone || "N/A",
          address: order.shippingAddress || [order.streetAddress, order.city, order.state, order.zipCode, order.country].filter(Boolean).join(", ") || "N/A",
        };

        const billingAddrObj = order.billingAddress
          ? {
              name: order.billingAddress.name || order.customerName || "Valued Customer",
              phone: order.billingAddress.phone || order.customerPhone || "N/A",
              address: order.billingAddress.address || order.shippingAddress || "N/A",
            }
          : shippingAddrObj;

        let mappedStatus: OrderStatus = "confirmed";
        const rawStatus = (order.status || "").toLowerCase();
        if (["cancelled", "delivered", "shipped", "packed", "pending"].includes(rawStatus)) {
          mappedStatus = rawStatus as OrderStatus;
        }

        setSelectedStatus(mappedStatus); // Sync Dropdown state

        const totalVal = typeof order.totalPrice === "number" ? order.totalPrice : 0;
        const discountVal = typeof order.discountAmount === "number" ? order.discountAmount : 0;
        const shippingCostVal = typeof order.shippingCost === "number" ? order.shippingCost : 0;
        const codFeeVal = typeof order.codFee === "number" ? order.codFee : 0;

        const subtotalVal = typeof order.originalPrice === "number"
          ? order.originalPrice
          : Math.max(0, totalVal + discountVal - shippingCostVal - codFeeVal);

        setOrderData({
          orderNumber: order.orderId || order._id || targetId,
          purchaseDate: formattedPurchaseDate,
          expectedDate: formattedExpectedDate,
          paymentMethod: ["cod", "razorpay"].includes(order.paymentThrough || order.paymentProvider)
            ? order.paymentThrough === "cod" || order.paymentProvider === "cod" ? "Cash on Delivery (COD)" : "Online (UPI / Cards / Wallets)"
            : order.paymentMethod || "Prepaid Card / UPI",
          status: mappedStatus,
          items: mappedItems,
          shippingAddress: shippingAddrObj,
          billingAddress: billingAddrObj,
          summary: {
            subtotal: subtotalVal,
            delivery: shippingCostVal,
            codFee: codFeeVal,
            coupon: order.appliedCoupon ? { code: order.appliedCoupon, discount: discountVal } : undefined,
            total: totalVal,
          },
        });
      } else {
        setError(`No active entries found matching Order ID: ${targetId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process lookup.");
    } finally {
      setLoading(false);
    }
  };

  // Securely update status back to Sanity dataset via backend actions
  const handleSaveChanges = async () => {
    if (!docId || !orderData) return;
    setUpdating(true);

    const result = await updateOrderStatus(docId, selectedStatus);

    if (result.success) {
      setOrderData({ ...orderData, status: selectedStatus });
      alert(`🎉 Database successfully updated to: ${selectedStatus.toUpperCase()}`);
    } else {
      alert(`⚠️ Error saving changes: ${result.error}`);
    }
    setUpdating(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLiveDetails(orderId);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase();

    // If they pasted a value containing ZV- twice (e.g. ZV-ZV-XYZ)
    if (value.startsWith("ZV-ZV-")) {
      value = value.slice(3); // Keep only one ZV-
    }

    // If the input was cleared entirely, set it back to "ZV-"
    if (value.length < 3) {
      setOrderId("ZV-");
      return;
    }

    // If it doesn't start with "ZV-", auto-prepend "ZV-"
    if (!value.startsWith("ZV-")) {
      value = "ZV-" + value;
    }

    const contentPart = value.slice(3);
    if (/^[A-Z0-9-]*$/.test(contentPart) && value.length <= 25) {
      setOrderId(value);
    }
  };

  return (
    <div className="max-w-6xl min-h-[calc(100vh-10rem)] mx-auto px-4 flex flex-col items-center md:px-20 font-sans text-slate-700 antialiased">
      {(!initialOrderId || error) && (
        <div className="mb-10 w-full max-w-xl">
          <h1 className="text-3xl px-2 font-bold tracking-tight mb-2 text-slate-900 text-center">
            Warehouse Dashboard
          </h1>
          <form
            onSubmit={handleFormSubmit}
            className="flex flex-col sm:flex-row gap-4 items-end bg-white p-5 rounded-xl border border-slate-200 shadow-sm w-full"
          >
            <div className="w-full sm:flex-1">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Scan / Enter Order ID
              </label>
              <input
                type="text"
                value={orderId}
                onChange={handleInputChange}
                onFocus={() => !orderId && setOrderId("ZV-")}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-mono tracking-wider"
                placeholder="ZV-LZZ1Y2ZO-4819"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 h-10.5 shadow-sm"
            >
              <span>Find Order</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500 animate-pulse py-4">Fetching database...</p>}
      {error && <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm my-4 max-w-lg">{error}</div>}

      {orderData && !loading && (
        <div className="space-y-8 mt-6 w-full animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900 font-mono">
                  Order No. {orderData.orderNumber}
                </span>
                <button
                  className="text-slate-400 hover:text-blue-600 transition-colors"
                  onClick={() => navigator.clipboard.writeText(orderData.orderNumber)}
                >
                  <Clipboard size={16} />
                </button>
              </div>
            </div>
            <div className="mt-2 sm:mt-0 text-sm text-slate-500">
              Purchased: <span className="font-medium text-slate-900">{orderData.purchaseDate}</span>
            </div>
          </div>

          {/* WORKFLOW MANAGEMENT DROPDOWN CONTROLLER */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-900">Manage Order Fulfillment</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Current Live Status: <span className="font-bold uppercase text-slate-700">{orderData.status}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                className="flex-1 sm:w-56 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pending">⏳ Pending</option>
                <option value="confirmed">✅ Confirmed</option>
                <option value="packed">📦 Packaged</option>
                <option value="shipped">🚚 Shipped</option>
                <option value="cancelled">❌ Cancelled</option>
              </select>
              
              <button
                onClick={handleSaveChanges}
                disabled={updating}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <Save size={16} />
                <span>{updating ? "Saving..." : "Save Status"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* PRODUCTS */}
            <div className="lg:col-span-2 flex flex-col space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Items Manifest Checklist
              </h3>
              {orderData.items.map((item) => (
                <div
                  key={item.id}
                  className="w-full justify-between flex items-center p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-lg border border-slate-100" />
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{item.name}</h4>
                      {item.specs && <p className="text-xs text-slate-400 mt-0.5">{item.specs}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-8 text-right">
                    <span className="text-xs text-slate-400">Qty: <strong className="text-slate-900">{item.qty}</strong></span>
                    <span className="font-bold text-sm text-slate-900">₹{item.price.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* FINANCIALS & SHIPPING CARDS */}
            <div className="lg:col-span-1 flex flex-col space-y-6">
              <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">Shipping Location</h4>
                <p className="text-sm font-bold text-slate-800">{orderData.shippingAddress.name}</p>
                <p className="text-sm text-slate-500 my-1">{orderData.shippingAddress.phone}</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-2">{orderData.shippingAddress.address}</p>
              </div>

              <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">Financial Overview</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Items Value</span>
                    <span className="font-semibold text-slate-900">₹{orderData.summary.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Delivery</span>
                    {orderData.summary.delivery === 0 ? (
                      <span className="font-semibold text-green-600 uppercase text-[11px]">Free</span>
                    ) : (
                      <span className="font-semibold text-slate-900">₹{orderData.summary.delivery.toFixed(2)}</span>
                    )}
                  </div>
                  {orderData.summary.codFee !== undefined && orderData.summary.codFee > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>COD Handling Fee</span>
                      <span className="font-semibold text-slate-900">₹{orderData.summary.codFee.toFixed(2)}</span>
                    </div>
                  )}
                  {orderData.summary.coupon && (
                    <div className="flex justify-between text-green-600">
                      <span>Coupon Applied ({orderData.summary.coupon.code})</span>
                      <span>- ₹{orderData.summary.coupon.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-dashed border-slate-200 pt-3 mt-2 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-slate-900">Total Bill</span>
                    <span className="text-lg font-black text-slate-900">₹{orderData.summary.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}