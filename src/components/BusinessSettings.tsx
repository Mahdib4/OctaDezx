import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Database } from '@/integrations/supabase/types';

const defaultAiInstructions = `Your primary goal is to assist customers based ONLY on the provided business description, policies, and product catalog.

1. **Stick to the facts:** If a customer asks about a product that is not in the catalog, you must state that you do not carry that product. Do not invent products, features, or prices.

2. **Be concise:** Keep your answers short and conversational, as if you were a helpful human assistant in a text chat. Avoid long paragraphs.

3. **Language Proficiency:** If a customer writes in a mix of English and another language (e.g., Banglish, Hinglish), you must identify the non-English language and respond fluently and ONLY in that language. For instance, if a query is in Banglish, your response must be in Bengali. If a query is in Hinglish, your response must be in Hindi.

4. **Tone:** Be friendly, helpful, and professional.`;

type Business = Database["public"]["Tables"]["businesses"]["Row"];

interface BusinessSettingsProps {
  business: Business;
  onSettingsUpdated: (updatedBusiness: Business) => void;
}

const BusinessSettings: React.FC<BusinessSettingsProps> = ({ business, onSettingsUpdated }) => {
  const { toast } = useToast();
  const [description, setDescription] = useState(business.description || '');
  const [policies, setPolicies] = useState(business.policies || '');
  const [aiInstructions, setAiInstructions] = useState(business.ai_instructions || defaultAiInstructions);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .update({ description, policies, ai_instructions: aiInstructions })
        .eq('id', business.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        onSettingsUpdated(data);
        setIsEditing(false);
        toast({
          title: 'Success',
          description: 'Settings updated successfully.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error updating settings',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Business Description</h4>
              <Textarea
                value={description ?? ''}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <h4 className="font-semibold mb-2">Business Policies</h4>
              <Textarea
                value={policies ?? ''}
                onChange={(e) => setPolicies(e.target.value)}
                rows={6}
              />
            </div>
            <div>
              <h4 className="font-semibold mb-2">AI Instructions</h4>
              <Textarea
                value={aiInstructions ?? ''}
                onChange={(e) => setAiInstructions(e.target.value)}
                rows={6}
              />
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
             <div>
              <h4 className="font-semibold mb-2">Business Description</h4>
              <div className="bg-muted p-3 rounded-md max-h-32 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">
                  {business.description || 'No description set'}
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Business Policies</h4>
              <div className="bg-muted p-3 rounded-md max-h-32 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">
                  {business.policies || 'No policies set'}
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">AI Instructions</h4>
              <div className="bg-muted p-3 rounded-md max-h-32 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">
                  {business.ai_instructions || defaultAiInstructions}
                </p>
              </div>
            </div>
            <Button onClick={() => setIsEditing(true)}>Edit Settings</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BusinessSettings;
