import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Bot, Send, Image as ImageIcon, Loader2, X } from "lucide-react";

interface Business {
  id: string;
  name: string;
  description: string;
}

interface Message {
  id: string;
  sender_type: 'customer' | 'ai' | 'human';
  content: string;
  image_url?: string;
  created_at: string;
}

const CustomerChat = () => {
  const { businessId: maybeBusinessId } = useParams();
  const { toast } = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [stagedImage, setStagedImage] = useState<File | null>(null);
  const [customerInfo, setCustomerInfo] = useState({ name: "", email: "" });
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  if (!maybeBusinessId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Link</h1>
          <p className="text-muted-foreground">
            The chat link is missing business information.
          </p>
        </div>
      </div>
    );
  }

  const businessId = maybeBusinessId;

  useEffect(() => {
    loadBusiness();
  }, [businessId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;

    loadMessages(); // Initial load

    const interval = setInterval(() => {
      loadMessages();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [sessionId]);

  const loadBusiness = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_public_business', { business_id: businessId });

      if (error || !data || data.length === 0) {
        throw (error || new Error('Business not found'));
      }
      setBusiness(data[0] as Business);
    } catch (error) {
      toast({
        title: "Error", 
        description: "The business you are looking for is not available",
        variant: "destructive",
      });
    }
  };

  const loadMessages = async () => {
    if (!sessionId) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as Message[]) || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const startChat = async () => {
    if (!customerInfo.name || !customerInfo.email) {
      toast({
        title: "Error",
        description: "Please provide your name and email",
        variant: "destructive",
      });
      return;
    }

    try {
      const newSessionId = generateUUID();
      const { error } = await supabase
        .from("chat_sessions")
        .insert({
            id: newSessionId,
            business_id: businessId,
            customer_name: customerInfo.name,
            customer_email: customerInfo.email,
        });

      if (error) throw error;

      setSessionId(newSessionId);
      setIsSetup(true);
      
      const welcomeMessage = "Hello! I'm your Customer Support assistant. How can I help you today?";
      const { data: msgData, error: messageError } = await supabase
        .from("chat_messages")
        .insert({
          session_id: newSessionId,
          sender_type: 'ai',
          content: welcomeMessage,
        })
        .select()
        .single();

      if (!messageError && msgData) {
        setMessages([msgData as Message]);
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start chat session",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = (file: File) => {
    setStagedImage(file);
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !stagedImage) || !sessionId) return;

    setLoading(true);

    const content = newMessage.trim();
    const tempStagedImage = stagedImage;
    
    setNewMessage("");
    setStagedImage(null);

    try {
      let imageUrl: string | undefined = undefined;

      if (tempStagedImage) {
        const file = tempStagedImage;
        const fileExt = file.name.split('.').pop();
        const fileName = `${sessionId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-files')
          .upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const { data: savedMessage, error: messageError } = await supabase
        .from("chat_messages")
        .insert({
          session_id: sessionId,
          sender_type: 'customer',
          content: content || 'Sent an image',
          image_url: imageUrl,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      if(savedMessage) {
        setMessages(prev => [...prev, savedMessage as Message]);
      }

      setTyping(true);

      const { data: aiResponse, error: functionError } = await supabase.functions.invoke('ai-chat-response', {
        body: {
          sessionId: sessionId,
          businessId: businessId,
          message: content || "User sent an image.",
        },
      });

      setTyping(false);

      if (functionError) {
        loadMessages();
        throw functionError;
      }
      
      if (aiResponse.response) {
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          sender_type: 'ai',
          content: aiResponse.response,
        });
      }

      loadMessages();

      if (aiResponse.escalated) {
          await supabase.from('chat_sessions').update({ status: 'escalated', escalation_reason: aiResponse.reason }).eq('id', sessionId);
      }

    } catch (error) {
      setTyping(false);
      setNewMessage(content);
      setStagedImage(tempStagedImage);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Business Not Found</h1>
          <p className="text-muted-foreground">
            The chat service you're looking for is not available.
          </p>
        </div>
      </div>
    );
  }

  if (!isSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Bot className="h-16 w-16 mx-auto mb-4 text-primary" />
            <CardTitle>Chat with {business.name}</CardTitle>
            <CardDescription>{business.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Name</label>
              <Input
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Email</label>
              <Input
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter your email"
              />
            </div>
            <Button onClick={startChat} className="w-full">
              Start Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-card p-4">
        <div className="flex items-center space-x-3">
          <Bot className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-semibold">{business.name} - Customer Care</h1>
            <p className="text-sm text-muted-foreground">
              Customer: {customerInfo.name}
            </p>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender_type === 'customer' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.sender_type === 'customer'
                    ? 'bg-blue-500 text-white'
                    : 'bg-muted'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {message.sender_type === 'customer' ? customerInfo.name : 'Customer Support'}
                  </Badge>
                </div>
                <div className="text-sm">{message.content}</div>
                {message.image_url && (
                  <img
                    src={message.image_url}
                    alt="Uploaded content"
                    className="mt-2 max-w-full rounded border"
                  />
                )}
              </div>
            </div>
          ))}
          
          {typing && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">Customer Support</Badge>
                </div>
                <div className="flex items-center space-x-1 mt-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Typing...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t bg-card p-4">
        <div className="max-w-3xl mx-auto">
          {stagedImage && (
            <div className="relative bg-muted p-2 rounded-lg mb-2">
              <div className="flex items-center space-x-2">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground truncate">{stagedImage.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setStagedImage(null)} className="absolute top-1 right-1 h-6 w-6">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === 'Enter' && !loading && sendMessage()}
            />
            <Button onClick={sendMessage} disabled={loading || (!newMessage.trim() && !stagedImage)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerChat;