"use client";

import React, { useState, useEffect } from "react";
import {
  Clipboard,
  ArrowRight,
  Save,
  Search,
  Filter,
  CreditCard,
  Coins,
  Truck,
  Calendar,
  User,
  ShoppingBag,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { OrderData, OrderStatus } from "./types/order";
import { updateOrderStatus, getAllOrders } from "./action"; // Import secure server actions

export default function WarehouseDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Selected Order details
  const [selectedOrderRaw, setSelectedOrderRaw] = useState<any | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>("confirmed");
  const [updating, setUpdating] = useState<boolean>(false);

  // Lock and session states
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [pinDigits, setPinDigits] = useState<string[]>(Array(6).fill(""));
  const [pinError, setPinError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);

  useEffect(() => {
    loadAllOrders();
  }, []);

  // PIN lock inactivity timer and events
  useEffect(() => {
    if (isLocked) return;

    const resetTimer = () => {
      setSecondsRemaining(600);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsLocked(true);
          return 600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      clearInterval(interval);
    };
  }, [isLocked]);

  // Auto-verify when 6 digits are filled
  useEffect(() => {
    const enteredPin = pinDigits.join("");
    if (enteredPin.length === 6) {
      if (enteredPin === "231245") {
        setIsLocked(false);
        setPinError(null);
        setPinDigits(Array(6).fill(""));
        setSecondsRemaining(600);
      } else {
        setPinError("Incorrect PIN. Please try again.");
        setPinDigits(Array(6).fill(""));
        setTimeout(() => {
          document.getElementById("pin-0")?.focus();
        }, 10);
      }
    }
  }, [pinDigits]);

  const handlePinChange = (value: string, index: number) => {
    const newDigits = [...pinDigits];
    newDigits[index] = value.replace(/[^0-9]/g, "").slice(-1);
    setPinDigits(newDigits);
    setPinError(null);

    if (newDigits[index] && index < 5) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handlePinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  const loadAllOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAllOrders();
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch orders.");
      }
      const fetchedOrders = result.data || [];
      setOrders(fetchedOrders);
      // Removed auto-select code to make dashboard open blank on load
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  };

  const selectOrder = (order: any) => {
    if (!order) return;
    setSelectedOrderRaw(order);

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
      orderNumber: order.orderId || order._id,
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
  };

  const handleSaveChanges = async () => {
    if (!selectedOrderRaw?._id || !orderData) return;
    setUpdating(true);

    const result = await updateOrderStatus(selectedOrderRaw._id, selectedStatus);

    if (result.success) {
      setOrderData({ ...orderData, status: selectedStatus });
      
      // Update in-memory orders list
      setOrders(prevOrders => 
        prevOrders.map(o => o._id === selectedOrderRaw._id ? { ...o, status: selectedStatus } : o)
      );
      
      alert(`🎉 Database successfully updated to: ${selectedStatus.toUpperCase()}`);
    } else {
      alert(`⚠️ Error saving changes: ${result.error}`);
    }
    setUpdating(false);
  };

  // Filter orders by search term and status
  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.toLowerCase();
    const orderIdVal = (order.orderId || "").toLowerCase();
    const customerVal = (order.customerName || "").toLowerCase();
    const phoneVal = (order.customerPhone || "").toLowerCase();
    const matchesSearch = orderIdVal.includes(term) || customerVal.includes(term) || phoneVal.includes(term);

    const matchesStatus = statusFilter === "all" || (order.status || "").toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeStyles = (status: string) => {
    const cleanStatus = status?.toLowerCase() || "";
    switch (cleanStatus) {
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200/60";
      case "confirmed":
        return "bg-blue-50 text-blue-700 border-blue-200/60";
      case "packed":
        return "bg-indigo-50 text-indigo-700 border-indigo-200/60";
      case "shipped":
        return "bg-purple-50 text-purple-700 border-purple-200/60";
      case "delivered":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
      case "cancelled":
        return "bg-rose-50 text-rose-700 border-rose-200/60";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200/60";
    }
  };

  const getStatusEmoji = (status: string) => {
    const cleanStatus = status?.toLowerCase() || "";
    switch (cleanStatus) {
      case "pending": return "⏳";
      case "confirmed": return "✅";
      case "packed": return "📦";
      case "shipped": return "🚚";
      case "delivered": return "🏠";
      case "cancelled": return "❌";
      default: return "📄";
    }
  };

  const getPaymentProviderBadge = (provider: string) => {
    const isCod = provider?.toLowerCase() === "cod";
    return isCod ? (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/60">
        <Coins size={10} /> COD
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200/60">
        <CreditCard size={10} /> Online
      </span>
    );
  };

  // Lock Overlay UI
  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl max-w-sm w-full text-center">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Enter PIN</h2>
          
          <div className="flex gap-2 mb-4 justify-center">
            {pinDigits.map((digit, idx) => (
              <input
                key={idx}
                id={`pin-${idx}`}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinChange(e.target.value, idx)}
                onKeyDown={(e) => handlePinKeyDown(e, idx)}
                autoFocus={idx === 0}
                className="w-10 h-12 border border-slate-300 rounded-lg text-center text-lg font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
              />
            ))}
          </div>

          {pinError && (
            <p className="text-xs text-rose-600 mb-4 font-semibold">
              {pinError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans antialiased overflow-hidden w-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0 w-full">
        <div className="flex items-center gap-3">
          <img
            src="/LogoIcon.png"
            alt="Logo"
            className="h-9 w-9 object-contain rounded-lg"
          />
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Warehouse Fulfillment</h1>
            <p className="text-xs text-slate-400">Manage orders, packaging & tracking dispatch</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadAllOrders}
            disabled={loading}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Sync</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative w-full">
        {/* Left Side: Orders List */}
        <div className={`w-full md:w-85 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden ${orderData ? "hidden md:flex" : "flex"}`}>
          {/* Search & Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ID, customer, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">⏳ Pending</option>
                <option value="confirmed">✅ Confirmed</option>
                <option value="packed">📦 Packaged</option>
                <option value="cancelled">❌ Cancelled</option>
              </select>
            </div>
          </div>

          {/* Orders Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No orders found</div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrderRaw?._id === order._id;
                const formattedPrice = typeof order.totalPrice === "number" ? order.totalPrice.toFixed(2) : "0.00";
                return (
                  <button
                    key={order._id}
                    onClick={() => selectOrder(order)}
                    className={`w-full text-left p-4 transition-colors flex flex-col gap-2 hover:bg-slate-50/70 border-l-4 ${
                      isSelected ? "bg-blue-50/50 border-blue-600" : "border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-850">
                        {order.orderId || order._id.slice(0, 10) + "..."}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full ${getStatusBadgeStyles(order.status)}`}>
                        {getStatusEmoji(order.status)} {order.status || "confirmed"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-slate-700 truncate max-w-[150px]">
                        {order.customerName || "Valued Customer"}
                      </span>
                      <span className="font-extrabold text-slate-900">₹{formattedPrice}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"}</span>
                      {getPaymentProviderBadge(order.paymentThrough || order.paymentProvider)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Order Detail View */}
        <div className={`flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 ${!orderData ? "hidden md:flex items-center justify-center text-slate-400" : "flex"}`}>
          {!orderData ? (
            <div className="text-center space-y-2">
              <ShoppingBag size={48} className="mx-auto text-slate-300 stroke-1" />
              <p className="text-sm font-semibold">Select an order from the list to view its details</p>
            </div>
          ) : (
            <div className="max-w-4xl w-full mx-auto space-y-6">
              {/* Back button for mobile */}
              <button
                onClick={() => {
                  setOrderData(null);
                  setSelectedOrderRaw(null);
                }}
                className="md:hidden flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg bg-white shadow-sm cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to list
              </button>

              {/* Order Identity Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-slate-900 font-mono">
                      Order: {orderData.orderNumber}
                    </span>
                    <button
                      className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(orderData.orderNumber);
                        alert("Copied Order ID to clipboard!");
                      }}
                      title="Copy Order ID"
                    >
                      <Clipboard size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {orderData.purchaseDate}</span>
                    <span className="flex items-center gap-1"><Truck size={12} /> Exp: {orderData.expectedDate}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-750 border border-slate-200 rounded-full flex items-center gap-1.5">
                    Mode of Payment: <strong className="text-slate-950 font-bold">{orderData.paymentMethod}</strong>
                  </span>
                </div>
              </div>

              {/* Manage Fulfillment Dropdown */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Manage Order Fulfillment</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Current Status: <span className="font-bold uppercase text-slate-750">{orderData.status}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                    className="flex-1 sm:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">⏳ Pending</option>
                    <option value="confirmed">✅ Confirmed</option>
                    <option value="packed">📦 Packaged</option>
                    <option value="cancelled">❌ Cancelled</option>
                  </select>
                  
                  <button
                    onClick={handleSaveChanges}
                    disabled={updating}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={14} />
                    <span>{updating ? "Saving..." : "Save Status"}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Product Manifest Checklist */}
                <div className="lg:col-span-2 flex flex-col space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-455 uppercase tracking-wider">
                    Manifest Items Checklist
                  </h3>
                  {orderData.items.map((item) => (
                    <div
                      key={item.id}
                      className="w-full justify-between flex items-center p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-lg border border-slate-100" />
                        <div>
                          <h4 className="font-semibold text-slate-900 text-sm">{item.name}</h4>
                          {item.specs && <p className="text-xs text-slate-400 mt-0.5">{item.specs}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <span className="text-xs text-slate-450">Qty: <strong className="text-slate-950 font-extrabold">{item.qty}</strong></span>
                        <span className="font-extrabold text-sm text-slate-900">₹{item.price.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shipping & Financial Overview */}
                <div className="lg:col-span-1 flex flex-col space-y-6">
                  {/* Shipping Info */}
                  <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                    <h4 className="text-xs font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3 flex items-center gap-1.5">
                      <User size={12} /> Shipping details
                    </h4>
                    <p className="text-sm font-bold text-slate-800">{orderData.shippingAddress.name}</p>
                    <p className="text-xs text-slate-500 my-1 font-semibold">{orderData.shippingAddress.phone}</p>
                    <p className="text-xs text-slate-500 leading-relaxed mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">{orderData.shippingAddress.address}</p>
                  </div>

                  {/* Pricing Overview */}
                  <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                    <h4 className="text-xs font-extrabold text-slate-455 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">
                      Financial overview
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal</span>
                        <span className="font-semibold text-slate-900">₹{orderData.summary.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Delivery</span>
                        {orderData.summary.delivery === 0 ? (
                          <span className="font-bold text-green-600 uppercase text-[10px]">Free</span>
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
                        <div className="flex justify-between text-green-600 font-medium">
                          <span>Coupon ({orderData.summary.coupon.code})</span>
                          <span>- ₹{orderData.summary.coupon.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-dashed border-slate-200 pt-3 mt-2 flex justify-between items-baseline">
                        <span className="text-sm font-bold text-slate-950">Total Bill</span>
                        <span className="text-lg font-black text-slate-900">₹{orderData.summary.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}