import React from 'react';
import { CustomerProvider } from '~/lib/context/customer-context';
import { AppLayout } from '~/app/_components/app-layout';

interface CustomerLayoutProps {
  children: React.ReactNode;
  params: {
    customerId: string;
  };
}

// Layouts themselves are Server Components by default
export default function CustomerLayout({ children, params }: CustomerLayoutProps) {
  // Directly access params.customerId - should be safe in layout server component
  const customerId = params.customerId;

  if (!customerId) {
    console.error("Customer ID missing in layout params. This shouldn't happen.");
    // Consider throwing an error or redirecting here
    return (
      <div>Error: Customer context could not be established. Invalid URL.</div>
    );
  }

  // Provide the customer context *and* render the AppLayout
  return (
    <CustomerProvider initialCustomerId={customerId}>
      {/* AppLayout now wraps the actual page content ({children}) */}
      <AppLayout>
        {children} 
      </AppLayout>
    </CustomerProvider>
  );
} 