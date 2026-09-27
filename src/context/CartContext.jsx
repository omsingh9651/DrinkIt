import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

const LOCAL_STORAGE_KEY = 'drinkit_cart_items_v1';

export function CartProvider({ children }) {
  // Initialize state from localStorage
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Failed to parse cart from localStorage', err);
      return [];
    }
  });

  // Toast notification for user actions
  const [toastMessage, setToastMessage] = useState(null);

  // Sync to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save cart to localStorage', err);
    }
  }, [items]);

  // Show a temporary feedback message
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2400);
  };

  /**
   * Helper to check current quantity of an item in the cart
   */
  const getItemQuantity = (productId) => {
    const item = items.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  /**
   * Add a product to the cart with specified quantity, strictly respecting available stock.
   */
  const addToCart = (product, quantity = 1) => {
    const maxStock =
      product.stockQuantity !== undefined
        ? Number(product.stockQuantity)
        : product.inStock === false
          ? 0
          : 99;

    if (maxStock <= 0 || product.inStock === false) {
      triggerToast(`"${product.name}" is currently out of stock`);
      return false;
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    let success = true;
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.product.id === product.id);

      if (existingIndex > -1) {
        const currentQty = prevItems[existingIndex].quantity;
        if (currentQty >= maxStock) {
          triggerToast(`"${product.name}" is already at maximum available stock (${maxStock})`);
          success = false;
          return prevItems;
        }

        const newQty = currentQty + qty;
        if (newQty > maxStock) {
          const addedAmount = maxStock - currentQty;
          triggerToast(
            `Added ${addedAmount} × "${product.name}" (reached stock limit of ${maxStock})`
          );
          const updated = [...prevItems];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: maxStock,
          };
          return updated;
        }

        const updated = [...prevItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
        };
        triggerToast(`Added ${qty} × "${product.name}" to cart`);
        return updated;
      }

      const initialQty = Math.min(qty, maxStock);
      if (initialQty < qty) {
        triggerToast(
          `Added ${initialQty} × "${product.name}" (only ${maxStock} available in stock)`
        );
      } else {
        triggerToast(`Added ${initialQty} × "${product.name}" to cart`);
      }
      return [...prevItems, { product, quantity: initialQty }];
    });

    return success;
  };

  /**
   * Update quantity of an item, capped to available stock. Removes if qty <= 0.
   */
  const updateQuantity = (productId, newQuantity) => {
    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      removeFromCart(productId);
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const maxStock =
            item.product.stockQuantity !== undefined
              ? Number(item.product.stockQuantity)
              : 99;
          const cappedQty = Math.min(qty, maxStock);
          if (qty > maxStock) {
            triggerToast(`Limited to available stock of ${maxStock} bottles`);
          }
          return { ...item, quantity: cappedQty };
        }
        return item;
      })
    );
  };

  /**
   * Increment quantity by 1, respecting available stock
   */
  const increaseQuantity = (productId) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const maxStock =
            item.product.stockQuantity !== undefined
              ? Number(item.product.stockQuantity)
              : 99;
          if (item.quantity >= maxStock) {
            triggerToast(`Maximum stock limit (${maxStock}) reached`);
            return item;
          }
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      })
    );
  };

  /**
   * Decrement quantity by 1. Removes item if quantity reaches 0.
   */
  const decreaseQuantity = (productId) => {
    setItems((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;
      if (item.quantity <= 1) {
        return prev.filter((i) => i.product.id !== productId);
      }
      return prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i
      );
    });
  };

  /**
   * Remove an item completely from the cart
   */
  const removeFromCart = (productId) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
    triggerToast('Item removed from cart');
  };

  /**
   * Clear the entire cart
   */
  const clearCart = () => {
    setItems([]);
  };

  // Calculations
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

  const subtotal = items.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  // Free shipping on orders over ₹999, else ₹99 (or ₹0 if cart is empty)
  const shipping = items.length === 0 ? 0 : subtotal >= 999 ? 0 : 99;

  // Estimated GST (5%)
  const estimatedTax = Math.round(subtotal * 0.05);

  const totalPrice = subtotal + shipping + estimatedTax;

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        subtotal,
        shipping,
        estimatedTax,
        totalPrice,
        toastMessage,
        getItemQuantity,
        addToCart,
        updateQuantity,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
