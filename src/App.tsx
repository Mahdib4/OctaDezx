import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";  // This should be your original Auth page with sign-in/sign-up
import Dashboard from "./pages/Dashboard";
import CustomerChat from "./pages/CustomerChat";
import NotFound from "./pages/NotFound";
import AuthCallback from "@/components/AuthCallback";
import VerificationCompleted from "./pages/VerificationCompleted";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
    
      if (loading) {
          return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
            }
              
                if (!user) {
                    return <Navigate to="/auth" replace />;
                      }
                        
                          return <>{children}</>;
                          };

                          const PublicRoute = ({ children }: { children: React.ReactNode }) => {
                            const { user, loading } = useAuth();
                              
                                if (loading) {
                                    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
                                      }
                                        
                                          if (user) {
                                              return <Navigate to="/dashboard" replace />;
                                                }
                                                  
                                                    return <>{children}</>;
                                                    };

                                                    const App = () => (
                                                      <QueryClientProvider client={queryClient}>
                                                          <AuthProvider>
                                                                <TooltipProvider>
                                                                        <Toaster />
                                                                                <Sonner />
                                                                                        <BrowserRouter>
                                                                                                  <Routes>
                                                                                                              <Route 
                                                                                                                            path="/" 
                                                                                                                                          element={
                                                                                                                                                          <PublicRoute>
                                                                                                                                                                            <Index />
                                                                                                                                                                                            </PublicRoute>
                                                                                                                                                                                                          } 
                                                                                                                                                                                                                      />
                                                                                                                                                                                                                                  <Route 
                                                                                                                                                                                                                                                path="/auth" 
                                                                                                                                                                                                                                                              element={
                                                                                                                                                                                                                                                                              <PublicRoute>
                                                                                                                                                                                                                                                                                                <Auth />  {/* Your original Auth page with both options */}
                                                                                                                                                                                                                                                                                                                </PublicRoute>
                                                                                                                                                                                                                                                                                                                              } 
                                                                                                                                                                                                                                                                                                                                          />
                                                                                                                                                                                                                                                                                                                                                      <Route 
                                                                                                                                                                                                                                                                                                                                                                    path="/dashboard" 
                                                                                                                                                                                                                                                                                                                                                                                  element={
                                                                                                                                                                                                                                                                                                                                                                                                  <ProtectedRoute>
                                                                                                                                                                                                                                                                                                                                                                                                                    <Dashboard />
                                                                                                                                                                                                                                                                                                                                                                                                                                    </ProtectedRoute>
                                                                                                                                                                                                                                                                                                                                                                                                                                                  } 
                                                                                                                                                                                                                                                                                                                                                                                                                                                              />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                          <Route path="/chat/:businessId" element={<CustomerChat />} />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <Route path="/auth/callback" element={<AuthCallback />} />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  <Route path="/verification-completed" element={<VerificationCompleted />} />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              <Route path="*" element={<NotFound />} />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </Routes>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                </BrowserRouter>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      </TooltipProvider>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          </AuthProvider>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            </QueryClientProvider>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            );

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            export default App;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            