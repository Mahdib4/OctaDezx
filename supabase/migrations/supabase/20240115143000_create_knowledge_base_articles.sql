CREATE TABLE knowledge_base_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security if needed
ALTER TABLE knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- Create policy for business owners to manage their articles
CREATE POLICY "Business owners can manage their knowledge base articles"
  ON knowledge_base_articles
  FOR ALL
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));