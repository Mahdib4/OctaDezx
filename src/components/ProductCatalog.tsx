import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Upload, X, Edit } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const addFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);

  useEffect(() => {
    loadProducts();
  }, [businessId]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`*, product_images(*)`)
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProducts(data?.map(product => ({
        ...product,
        description: product.description || "",
        category: product.category || "",
        price: product.price || 0,
        images: (product.product_images || []).map((img: any) => ({ ...img, alt_text: img.alt_text || "" }))
      })) || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load products", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (files: FileList | null) => {
    if (files) {
        const currentTotal = (editingProduct?.images.length || 0) + uploadedImages.length;
        const newImages = Array.from(files).slice(0, 5 - currentTotal);
        setUploadedImages(prev => [...prev, ...newImages]);
    }
  };

  const removeNewImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleDeleteExistingImage = async (imageId: string, imageUrl: string) => {
    if (!editingProduct) return;

    try {
      const filePath = new URL(imageUrl).pathname.split('/product-images/')[1];
      if (!filePath) throw new Error("Could not determine file path from URL.");

      const { error: storageError } = await supabase.storage.from('product-images').remove([filePath]);
      if (storageError && storageError.message !== 'The resource was not found') {
        throw storageError;
      }

      const { error: dbError } = await supabase.from('product_images').delete().eq('id', imageId);
      if (dbError) throw dbError;

      setEditingProduct(prev => {
        if (!prev) return null;
        const updatedImages = prev.images.filter(img => img.id !== imageId);
        return { ...prev, images: updatedImages };
      });

      setProducts(prevProds => prevProds.map(p => {
        if (p.id === editingProduct.id) {
          return { ...p, images: p.images.filter(img => img.id !== imageId) };
        }
        return p;
      }));

      toast({ title: "Success", description: "Image deleted successfully." });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete image", variant: "destructive" });
    }
  };

  const uploadImages = async (productId: string) => {
    const imageUrls = [];
    const hasPrimaryImage = editingProduct ? editingProduct.images.some(img => img.is_primary) : false;
    for (let i = 0; i < uploadedImages.length; i++) {
      const file = uploadedImages[i];
      const fileName = `${productId}-${Date.now()}-${i}.${file.name.split('.').pop()}`;
      const { data, error } = await supabase.storage.from('product-images').upload(fileName, file);
      if (error) throw new Error(`Failed to upload ${file.name}: ${error.message}`);
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
      imageUrls.push({ product_id: productId, image_url: publicUrl, alt_text: file.name, is_primary: i === 0 && !hasPrimaryImage });
    }
    if (imageUrls.length > 0) {
      const { error } = await supabase.from('product_images').insert(imageUrls);
      if (error) throw new Error(`Failed to save image data: ${error.message}`);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productData = { business_id: businessId, name: formData.get("name") as string, description: formData.get("description") as string, category: formData.get("category") as string, price: parseFloat(formData.get("price") as string) || 0 };

    try {
      const { data, error } = await supabase.from("products").insert([productData]).select().single();
      if (error) throw error;
      if (uploadedImages.length > 0) await uploadImages(data.id);
      toast({ title: "Success", description: "Product added successfully!" });
      addFormRef.current?.reset();
      setAddDialogOpen(false);
      setUploadedImages([]);
      loadProducts();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to add product", variant: "destructive" });
    }
  };
  
  const handleUpdateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;

    const formData = new FormData(e.currentTarget);
    const productData = { name: formData.get("name") as string, description: formData.get("description") as string, category: formData.get("category") as string, price: parseFloat(formData.get("price") as string) || 0 };

    try {
      const { error } = await supabase.from("products").update(productData).eq("id", editingProduct.id);
      if (error) throw error;
      if (uploadedImages.length > 0) await uploadImages(editingProduct.id);
      toast({ title: "Success", description: "Product updated successfully!" });
      setEditingProduct(null);
      setUploadedImages([]);
      loadProducts();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update product", variant: "destructive" });
    }
  };

  if (loading) return <div className="text-center py-8">Loading products...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Product Catalog</h3>
          <p className="text-sm text-muted-foreground">Manage your products for the AI to reference</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Product</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Product</DialogTitle><DialogDescription>Add details and images for your AI.</DialogDescription></DialogHeader>
            <ScrollArea className="max-h-[70vh] -mx-6 pr-6">
              <form ref={addFormRef} onSubmit={handleAddSubmit} className="space-y-4 px-6 pb-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" name="category" placeholder="e.g., Electronics" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" name="price" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" placeholder="Detailed product description..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Images</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedImages.map((file, index) => (
                      <div key={index} className="relative">
                        <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-24 object-cover rounded" />
                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeNewImage(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {uploadedImages.length < 5 && (
                      <Label htmlFor="image-upload" className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded cursor-pointer">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <Input id="image-upload" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files)} />
                      </Label>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">You can upload up to 5 images.</p>
                </div>
                <Button type="submit" className="w-full">Add Product</Button>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No products yet.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id}>
              <CardHeader className="pb-2">
                {product.images.find(img => img.is_primary) && <img src={product.images.find(img => img.is_primary)?.image_url} alt={product.name} className="w-full h-40 object-cover rounded-md" />}
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <div className="flex items-center justify-between">
                  {product.category && <Badge variant="secondary">{product.category}</Badge>}
                  {product.price > 0 && <span className="font-semibold">${product.price}</span>}
                </div>
              </CardHeader>
              <CardContent><CardDescription className="line-clamp-2">{product.description}</CardDescription></CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" onClick={() => { setUploadedImages([]); setEditingProduct(product); }}><Edit className="h-4 w-4 mr-2" />Edit</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editingProduct !== null} onOpenChange={(isOpen) => !isOpen && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Product</DialogTitle><DialogDescription>Update product details and images.</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[70vh] -mx-6 pr-6">
            <form ref={editFormRef} onSubmit={handleUpdateSubmit} className="space-y-4 px-6 pb-2">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input id="name" name="name" required defaultValue={editingProduct?.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="e.g., Electronics" defaultValue={editingProduct?.category} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input id="price" name="price" type="number" step="0.01" placeholder="0.00" defaultValue={editingProduct?.price} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="Detailed product description..." rows={3} defaultValue={editingProduct?.description} />
              </div>
              <div className="space-y-2">
                <Label>Images</Label>
                <div className="grid grid-cols-3 gap-2">
                  {editingProduct?.images.map((image) => (
                    <div key={image.id} className="relative">
                      <img src={image.image_url} alt={image.alt_text} className="w-full h-24 object-cover rounded" />
                      <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => handleDeleteExistingImage(image.id, image.image_url)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {uploadedImages.map((file, index) => (
                    <div key={index} className="relative">
                      <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-24 object-cover rounded" />
                      <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeNewImage(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {((editingProduct?.images.length || 0) + uploadedImages.length) < 5 && (
                    <Label htmlFor="edit-image-upload" className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded cursor-pointer">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <Input id="edit-image-upload" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files)} />
                    </Label>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">You can have up to 5 images.</p>
              </div>
              <Button type="submit" className="w-full">Update Product</Button>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductCatalog;