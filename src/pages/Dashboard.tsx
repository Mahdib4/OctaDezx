import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LogOut, Bot, MessageSquare, Users, Settings, BookOpen, BarChart2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import BusinessSetup from "@/components/BusinessSetup";
import ProductCatalog from "@/components/ProductCatalog";
import ChatSessions from "@/components/ChatSessions";
import KnowledgeBase from "./KnowledgeBase";
import Analytics from "./Analytics";

interface Business {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  policies: string;
  ai_instructions: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadBusinesses();
    } else {
      setLoading(false);
    }
  }, [user]);

 const loadBusinesses = async () => {
  if (!user?.id) {
    toast({
      title: "Error",
      description: "User not authenticated",
      variant: "destructive",
    });
    setLoading(false);
    return;
  }

  try {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    const businessData = data as Business[];
    
    setBusinesses(businessData || []);
    if (businessData && businessData.length > 0) {
      setSelectedBusiness(businessData[0]);
    }
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to load businesses",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateChatLink = (businessId: string) => {
    return `${window.location.origin}/chat/${businessId}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Bot className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">OctaDezx AI Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {businesses.length === 0 ? (
          <BusinessSetup onBusinessCreated={loadBusinesses} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4">
              {businesses.map((business) => (
                <Card
                  key={business.id}
                  className={`cursor-pointer transition-all ${
                    selectedBusiness?.id === business.id
                      ? "ring-2 ring-primary"
                      : "hover:shadow-md"
                  }`}
                  onClick={() => setSelectedBusiness(business)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{business.name}</CardTitle>
                      <Badge variant={business.is_active ? "default" : "secondary"}>
                        {business.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription>{business.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      Chat Link: {generateChatLink(business.id)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedBusiness && (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Overview
                  </TabsTrigger>
                   <TabsTrigger value="analytics">
                    <BarChart2 className="h-4 w-4 mr-2" />
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger value="products">
                    <Settings className="h-4 w-4 mr-2" />
                    Products
                  </TabsTrigger>
                  <TabsTrigger value="chats">
                    <Users className="h-4 w-4 mr-2" />
                    Chat Sessions
                  </TabsTrigger>
                  <TabsTrigger value="knowledge-base">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Knowledge Base
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <Card>
                    <CardHeader>
                      <CardTitle>AI Configuration</CardTitle>
                      <CardDescription>
                        Your AI is ready to handle customer inquiries
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Chat Link</h4>
                        <div className="bg-muted p-3 rounded-md">
                          <code className="text-sm">
                            {generateChatLink(selectedBusiness.id)}
                          </code>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Share this link with your customers or add it to your auto-reply messages
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-2">Business Policies</h4>
                        <div className="bg-muted p-3 rounded-md max-h-32 overflow-y-auto">
                          <p className="text-sm whitespace-pre-wrap">
                            {selectedBusiness.policies || "No policies set"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">AI Instructions</h4>
                        <div className="bg-muted p-3 rounded-md max-h-32 overflow-y-auto">
                          <p className="text-sm whitespace-pre-wrap">
                            {selectedBusiness.ai_instructions || "No custom instructions set"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analytics">
                  <Analytics businessId={selectedBusiness.id} />
                </TabsContent>

                <TabsContent value="products">
                  <ProductCatalog businessId={selectedBusiness.id} />
                </TabsContent>

                <TabsContent value="chats">
                  <ChatSessions businessId={selectedBusiness.id} />
                </TabsContent>

                <TabsContent value="knowledge-base">
                  <KnowledgeBase businessId={selectedBusiness.id} />
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
