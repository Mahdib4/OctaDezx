import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Upload, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  images: Array<{
    id: string;
    image_url: string;
    alt_text: string;
    is_primary: boolean;
  }>;
}

interface ProductCatalogProps {
  businessId: string;
}

const ProductCatalog = ({ businessId }: ProductCatalogProps) => {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);

  useEffect(() => {
    loadProducts();
  }, [businessId]);

  const loadProducts = async () => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        product_images (
          id,
          image_url,
          alt_text,
          is_primary
        )
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    // Properly map the data to match the Product interface
    setProducts(data?.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description || "",
      category: product.category || "",
      price: product.price || 0,
      images: (product.product_images || []).map((img: any) => ({
        id: img.id,
        image_url: img.image_url,
        alt_text: img.alt_text || "",
        is_primary: img.is_primary || false
      }))
    })) || []);
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to load products",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};

  const handleImageUpload = (files: FileList | null) => {
    if (files) {
      const newImages = Array.from(files).slice(0, 5 - uploadedImages.length);
      setUploadedImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (productId: string) => {
    const imageUrls = [];
    
    for (let i = 0; i < uploadedImages.length; i++) {
      const file = uploadedImages[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}-${Date.now()}-${i}.${fileExt}`;
      
      try {
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(fileName, file);

        if (error) {
          console.error('Storage upload error:', error);
          throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        imageUrls.push({
          product_id: productId,
          image_url: publicUrl,
          alt_text: file.name,
          is_primary: i === 0
        });
      } catch (uploadError) {
        console.error(`Error uploading file ${file.name}:`, uploadError);
        throw uploadError;
      }
    }

    if (imageUrls.length > 0) {
      const { error } = await supabase
        .from('product_images')
        .insert(imageUrls);

      if (error) {
        console.error('Database insert error:', error);
        throw new Error(`Failed to save image data: ${error.message}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const productData = {
      business_id: businessId,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      price: parseFloat(formData.get("price") as string) || 0,
    };

    try {
      const { data, error } = await supabase
        .from("products")
        .insert([productData])
        .select()
        .single();

      if (error) throw error;

      if (uploadedImages.length > 0) {
        await uploadImages(data.id);
      }

      toast({
        title: "Success",
        description: "Product added successfully!",
      });

      // Reset form and state
      formRef.current?.reset();
      setDialogOpen(false);
      setUploadedImages([]);
      loadProducts();
    } catch (error) {
      console.error('Product submission error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add product",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Product Catalog</h3>
          <p className="text-sm text-muted-foreground">
            Add your products so the AI can answer customer questions and show images
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Add product details and images for your AI to reference
              </DialogDescription>
            </DialogHeader>
            
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pb-2">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input id="name" name="name" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="e.g., Electronics, Clothing" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input id="price" name="price" type="number" step="0.01" placeholder="0.00" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  placeholder="Detailed product description..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Product Images (Max 5)</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e.target.files)}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload images
                      </p>
                    </div>
                  </label>
                </div>
                
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {uploadedImages.map((file, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-20 object-cover rounded border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full">
                Add Product
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No products added yet. Add your first product to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id}>
              <CardHeader className="pb-2">
                {product.images.find(img => img.is_primary) && (
                  <img
                    src={product.images.find(img => img.is_primary)?.image_url}
                    alt={product.name}
                    className="w-full h-40 object-cover rounded-md"
                  />
                )}
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <div className="flex items-center justify-between">
                  {product.category && (
                    <Badge variant="secondary">{product.category}</Badge>
                  )}
                  {product.price > 0 && (
                    <span className="font-semibold">${product.price}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="line-clamp-2">
                  {product.description}
                </CardDescription>
                <div className="mt-2 text-xs text-muted-foreground">
                  {product.images.length} image(s)
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;