import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Bot, Send, Image as ImageIcon, Loader2, X, User, Shield, Building } from "lucide-react";

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
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  if (!maybeBusinessId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Invalid Link</h1>
          <p className="text-gray-400">
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

    const subscription = supabase
      .channel(`chat-messages:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setMessages((prevMessages) => [...prevMessages, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
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

  const startChat = async (skip = false) => {
    if (!skip && (!customerInfo.name || !customerInfo.email)) {
      toast({
        title: "Error",
        description: "Please provide your name and email",
        variant: "destructive",
      });
      return;
    }

    try {
      const newSessionId = generateUUID();
      const name = skip ? 'Anonymous' : customerInfo.name;
      const email = skip ? `${generateUUID()}@anonymous.com` : customerInfo.email;

      const { error } = await supabase
        .from("chat_sessions")
        .insert({
            id: newSessionId,
            business_id: businessId,
            customer_name: name,
            customer_email: email,
        });

      if (error) throw error;

      setCustomerInfo({ name, email });
      setSessionId(newSessionId);
      setIsSetup(true);
      
      const welcomeMessage = "Hello! I'm here to help you today. How can I assist you?";
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

    const content = newMessage.trim();
    const tempStagedImage = stagedImage;
    setNewMessage("");
    setStagedImage(null);
    setLoading(true);
    setTyping(true);

    try {
        let imageUrl: string | undefined = undefined;
        if (tempStagedImage) {
            const fileExt = tempStagedImage.name.split('.').pop();
            const fileName = `${sessionId}-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('chat-files').upload(fileName, tempStagedImage);
            if (uploadError) throw uploadError;
            imageUrl = supabase.storage.from('chat-files').getPublicUrl(fileName).data.publicUrl;
        }

        const { error: messageError } = await supabase.functions.invoke('ai-chat-response', {
            body: { 
                sessionId, 
                businessId, 
                message: content, 
                imageUrl 
            },
        });

        if (messageError) throw messageError;

    } catch (error) {
        console.error("Error sending message:", error);
        toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
        setNewMessage(content);
        setStagedImage(tempStagedImage);
    } finally {
        setLoading(false);
        setTyping(false);
    }
};

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Loading Business...</h1>
          <p className="text-gray-400">
            Please wait while we connect you to the chat service.
          </p>
        </div>
      </div>
    );
  }

  if (!isSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <Card className="w-full max-w-md bg-gray-800 text-white border-gray-700">
          <CardHeader className="text-center space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <Building className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-2xl">Chat with {business.name}</CardTitle>
            <CardDescription className="text-gray-300 text-base">{business.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Input
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter your name"
                className="bg-gray-700 text-white border-gray-600"
              />
              <Input
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter your email"
                className="bg-gray-700 text-white border-gray-600"
              />
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={() => startChat(false)} className="w-full bg-blue-600 hover:bg-blue-700">
                Start Chat
              </Button>
              <Button onClick={() => startChat(true)} variant="outline" className="w-full border-gray-600 hover:bg-gray-700">
                Continue Anonymously
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      <header className="border-b border-gray-700 bg-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="font-semibold text-lg">{business.name}</h1>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto space-y-4 pb-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-4 ${message.sender_type === 'customer' ? 'bg-blue-600 text-white' : 'bg-gray-800 border border-gray-700'}`}>
                <div className="text-sm">{message.content}</div>
                {message.image_url && (
                  <div className="mt-2">
                    <img src={message.image_url} alt="Uploaded content" className="max-w-full rounded-lg" />
                  </div>
                )}
                <div className="text-xs text-right mt-1 opacity-70">
                  {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="max-w-[80%] bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Bot className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Typing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-gray-700 bg-gray-800 p-4">
        <div className="max-w-4xl mx-auto">
          {stagedImage && (
            <div className="flex items-center justify-between bg-gray-700 p-2 rounded-lg mb-2">
              <span>{stagedImage.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setStagedImage(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <form 
            className="flex items-center space-x-3" 
            onSubmit={async (e) => { 
              e.preventDefault(); 
              await sendMessage(); 
            }}
          >
            <Button size="sm" onClick={() => fileInputRef.current?.click()} variant="outline" type="button">
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-700 border-gray-600"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || (!newMessage.trim() && !stagedImage)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            capture="environment"
          />
        </div>
      </div>
    </div>
  );
};

export default CustomerChat;