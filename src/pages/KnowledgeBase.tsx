import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

interface KnowledgeBaseProps {
  businessId: string;
}

interface Article {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ businessId }) => {
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [newArticle, setNewArticle] = useState({ title: "", content: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (businessId) {
      fetchArticles();
    }
  }, [businessId]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_base_articles')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching articles",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArticle.title || !newArticle.content) {
      toast({
        title: "Incomplete form",
        description: "Please fill out both title and content.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('knowledge_base_articles')
        .insert([
          { 
            business_id: businessId, 
            title: newArticle.title, 
            content: newArticle.content 
          }
        ])
        .select();

      if (error) throw error;
      
      if (data) {
        setArticles([data[0], ...articles]);
        setNewArticle({ title: "", content: "" });
        toast({
          title: "Success",
          description: "New article created.",
        });
      }

    } catch (error: any) {
      toast({
        title: "Error creating article",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Article</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateArticle} className="space-y-4">
            <Input
              placeholder="Article Title"
              value={newArticle.title}
              onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
            />
            <Textarea
              placeholder="Article Content"
              value={newArticle.content}
              onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
              rows={5}
            />
            <Button type="submit">Add Article</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Articles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading articles...</p>
          ) : articles.length === 0 ? (
            <p>No articles found.</p>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <div key={article.id} className="p-4 border rounded-md">
                  <h3 className="font-bold text-lg">{article.title}</h3>
                  <p className="text-sm text-muted-foreground">{new Date(article.created_at).toLocaleString()}</p>
                  <p className="mt-2 whitespace-pre-wrap">{article.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeBase;
