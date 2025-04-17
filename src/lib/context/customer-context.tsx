"use client";

import React, { createContext, useContext, useState, useMemo } from 'react';

// Define the shape of the context data
interface CustomerContextType {
  customerId: string | null;
  // We can add a setter later if needed, but for now, it's provided by the layout
}

// Create the context with a default value
const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

// Create a Provider component
interface CustomerProviderProps {
  children: React.ReactNode;
  initialCustomerId: string | null; // Provided by the server layout
}

export function CustomerProvider({ children, initialCustomerId }: CustomerProviderProps) {
  // Although the ID comes from the layout, using state allows potential future updates
  // For now, it just holds the initial value.
  const [customerId] = useState<string | null>(initialCustomerId);

  const value = useMemo(() => ({ customerId }), [customerId]);

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

// Create a custom hook for easy consumption
export function useCustomer() {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
} 