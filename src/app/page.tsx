import { redirect } from 'next/navigation';
import { auth } from "@clerk/nextjs/server";
import { api } from "~/trpc/server";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from '~/components/ui/button';

export default async function RootPage() {
  const { userId } = await auth();

  if (userId) {
    // User is signed in, fetch their customers
    try {
      const customers = await api.customer.list(); 
      
      if (customers && customers.length > 0) {
        const firstCustomerId = customers[0]!.id; 
        // This redirect will throw NEXT_REDIRECT
        redirect(`/customer/${firstCustomerId}/dashboard`); 
      } else {
        // Signed in, but no customers found
        return (
          <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
            <h1 className="text-4xl font-bold mb-4">Welcome!</h1>
            <p className="mb-6">You are signed in, but you don't have access to any customers yet.</p>
            {/* TODO: Add a button/link to create a customer */}
          </div>
        );
      }
    } catch (error: any) { // Type error explicitly
      // Check if the error is the specific NEXT_REDIRECT error
      if (error.digest?.startsWith('NEXT_REDIRECT')) {
        // If it is, re-throw it so Next.js can handle the redirect
        throw error;
      }
      
      // Otherwise, it's a genuine error fetching customers
      console.error("Error fetching customers for redirect (catch block):", error);
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
          <h1 className="text-4xl font-bold mb-4">Error</h1>
          <p className="mb-6">Could not load customer data. Please try again later.</p>
        </div>
      );
    }
  } else {
    // User is signed out, show a simple landing/sign-in page
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem] mb-6">
          Your App Name
        </h1>
        <p className="mb-8 text-lg">Welcome! Please sign in or sign up to continue.</p>
        <div className="flex gap-4">
          <SignInButton mode="modal">
            <Button variant="secondary">Sign In</Button>
          </SignInButton>
          <SignUpButton mode="modal">
             <Button variant="outline">Sign Up</Button>
          </SignUpButton>
        </div>
      </div>
    );
  }
}