import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const defaultAiInstructions = `Your primary goal is to assist customers based ONLY on the provided business description, policies, and product catalog.

1. **Stick to the facts:** If a customer asks about a product that is not in the catalog, you must state that you do not carry that product. Do not invent products, features, or prices.

2. **Be concise:** Keep your answers short and conversational, as if you were a helpful human assistant in a text chat. Avoid long paragraphs.

3. **Language Proficiency:** If a customer writes in a mix of English and another language (e.g., Banglish, Hinglish), you must identify the non-English language and respond fluently and ONLY in that language. For instance, if a query is in Banglish, your response must be in Bengali. If a query is in Hinglish, your response must be in Hindi.

4. **Tone:** Be friendly, helpful, and professional.`;

interface BusinessSetupProps {
  onBusinessCreated: () => void;
}

const BusinessSetup = ({ onBusinessCreated }: BusinessSetupProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const businessData = {
      owner_id: user.id,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      policies: formData.get("policies") as string,
      ai_instructions: formData.get("ai_instructions") as string || defaultAiInstructions,
    };

    try {
      const { error } = await supabase
        .from("businesses")
        .insert([businessData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Business AI configuration created successfully!",
      });

      onBusinessCreated();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create business configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Set Up Your AI Customer Service</CardTitle>
          <CardDescription>
            Configure your AI assistant to handle customer inquiries about your business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Enter your business name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Business Description</Label>
              <Textarea
                id="description"
                name="description"
                required
                placeholder="Describe what your business does, your services, target customers..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="policies">Business Policies</Label>
              <Textarea
                id="policies"
                name="policies"
                placeholder="Enter your return policy, shipping information, payment terms, warranty details..."
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Include return policies, shipping info, payment terms, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai_instructions">AI Instructions</Label>
              <Textarea
                id="ai_instructions"
                name="ai_instructions"
                defaultValue={defaultAiInstructions}
                rows={6}
              />
              <p className="text-sm text-muted-foreground">
                Specify the tone, personality, and specific guidelines for your AI assistant
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create AI Configuration
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessSetup;
