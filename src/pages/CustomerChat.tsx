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

  // Your Groq API Key - Direct access (also set in Netlify environment variables)
  const GROQ_API_KEY = "840b174675eac8b4d014f595d168e2dcba3318a0da2ad5d9afd22538b40afd36";

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

    loadMessages(); 

    const interval = setInterval(() => {
      loadMessages();
    }, 5000); 

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
    console.log("📱 Mobile: Image selected:", file.name);
    setStagedImage(file);
  };

  // MOBILE-OPTIMIZED sendMessage FUNCTION WITH DIRECT GROQ API
  const sendMessage = async () => {
    console.log("🚨 MOBILE DEBUG: sendMessage function CALLED");
    console.log("📱 Platform:", navigator.platform);
    console.log("📱 User Agent:", navigator.userAgent);
    
    if ((!newMessage.trim() && !stagedImage) || !sessionId) {
      console.log("❌ MOBILE: Validation failed");
      toast({
        title: "Cannot send",
        description: "Please type a message first",
        variant: "destructive",
      });
      return;
    }

    console.log("✅ MOBILE: Validation passed, proceeding...");
    
    setLoading(true);
    const content = newMessage.trim();
    const tempStagedImage = stagedImage;
    
    setNewMessage("");
    setStagedImage(null);

    try {
      console.log("📱 MOBILE: Starting mobile-optimized message process...");

      let imageUrl: string | undefined = undefined;

      // Image upload
      if (tempStagedImage) {
        console.log("📱 MOBILE: Uploading image...");
        const file = tempStagedImage;
        const fileExt = file.name.split('.').pop();
        const fileName = `${sessionId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-files')
          .upload(fileName, file);
        
        if (uploadError) {
          console.error("📱 MOBILE: Image upload failed:", uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
        console.log("📱 MOBILE: Image uploaded successfully");
      }

      // Save customer message to database
      console.log("📱 MOBILE: Saving customer message...");
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

      if (messageError) {
        console.error("📱 MOBILE: Database save failed:", messageError);
        throw messageError;
      }

      console.log("📱 MOBILE: Customer message saved to database");

      if(savedMessage) {
        setMessages(prev => [...prev, savedMessage as Message]);
      }

      // MOBILE-OPTIMIZED AI CALL - DIRECT TO GROQ API
      console.log("📱 MOBILE: Starting direct Groq API call...");
      setTyping(true);

      try {
        // Get business context
        const { data: businessData, error: businessError } = await supabase
          .from("businesses")
          .select(`*, products (id, name, description, category, price)`)
          .eq("id", businessId)
          .single();

        if (businessError) throw businessError;

        // Get chat history
        const { data: historyData } = await supabase
          .from("chat_messages")
          .select("sender_type, content")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })
          .limit(6);

        const history: Array<{role: string, content: string}> = (historyData || [])
          .map((m: any) => ({
            role: m.sender_type === 'ai' ? 'assistant' : 'user',
            content: m.content,
          }));

        // Create system prompt
        const products = (businessData.products || []).slice(0, 10);
        const catalog = products.length
          ? products.map((p: any) => `- ${p.name} (${p.category}) - $${p.price || 'N/A'}`).join('\n')
          : "No products available";

        const systemPrompt = `You are a helpful Customer Support agent for ${businessData.name}.
        
Business: ${businessData.name}
Description: ${businessData.description || ''}
Policies: ${businessData.policies || 'Standard policies apply'}

Available Products:
${catalog}

Important Rules:
- NEVER refer to yourself as an AI or language model
- Be helpful, professional, and sales-focused
- Recommend relevant products when appropriate
- Keep responses under 300 words
- Always be friendly and customer-oriented`;

        console.log("📱 MOBILE: Calling Groq API directly with key:", GROQ_API_KEY ? "PRESENT" : "MISSING");
        
        if (!GROQ_API_KEY) {
          throw new Error("Groq API key not configured");
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: systemPrompt },
              ...history,
              { role: "user", content: content || "User sent an image" }
            ],
            max_tokens: 450,
            temperature: 0.3,
          }),
        });

        console.log("📱 MOBILE: Groq API response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("📱 MOBILE: Groq API error:", response.status, errorText);
          throw new Error(`Groq API error: ${response.status}`);
        }

        const aiData = await response.json();
        const aiResponse = aiData.choices[0]?.message?.content;

        console.log("📱 MOBILE: Groq API success, response length:", aiResponse?.length);

        if (aiResponse) {
          // Save AI response to database
          await supabase.from('chat_messages').insert({
            session_id: sessionId,
            sender_type: 'ai',
            content: aiResponse,
          });
          
          console.log("📱 MOBILE: AI response saved to database");
        } else {
          console.log("📱 MOBILE: No AI response received, using fallback");
          // Fallback response
          await supabase.from('chat_messages').insert({
            session_id: sessionId,
            sender_type: 'ai',
            content: "Thanks for your message! I'll be happy to help you with that.",
          });
        }

      } catch (aiError) {
        console.error("📱 MOBILE: AI call failed:", aiError);
        // Fallback response when AI fails
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          sender_type: 'ai',
          content: "Thanks for your message! I'm here to help. How can I assist you today?",
        });
      }

      setTyping(false);

      // Reload messages to show both user and AI messages
      console.log("📱 MOBILE: Reloading messages...");
      loadMessages();

      console.log("📱 MOBILE: ✅ Message process completed successfully");

    } catch (error) {
      console.error("📱 MOBILE: ❌ Error in sendMessage:", error);
      setTyping(false);
      setNewMessage(content);
      setStagedImage(tempStagedImage);
      
      toast({
        title: "Connection Issue",
        description: "Please check your connection and try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // MOBILE-SPECIFIC EVENT HANDLER
  const handleSendMessageMobile = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    console.log("👆 MOBILE: Send button triggered via", 'touches' in e ? 'TOUCH' : 'CLICK');
    await sendMessage();
  };

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Business Not Found</h1>
          <p className="text-gray-400">
            The chat service you're looking for is not available.
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
            <div className="relative">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Building className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Chat with {business.name}</CardTitle>
            <CardDescription className="text-gray-300 text-base">{business.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Your Name
                </label>
                <Input
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your name"
                  className="bg-gray-700 text-white border-gray-600 focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Your Email
                </label>
                <Input
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter your email"
                  className="bg-gray-700 text-white border-gray-600 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => startChat(false)} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors duration-200"
              >
                Start Chat
              </Button>
              <Button 
                onClick={() => startChat(true)} 
                variant="outline"
                className="w-full border-gray-600 hover:bg-gray-700 text-gray-300 py-3 rounded-lg transition-colors duration-200"
              >
                Continue Anonymously
              </Button>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Your conversation is secure and private
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Building className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
            </div>
            <div>
              <h1 className="font-semibold text-lg">{business.name}</h1>
              <p className="text-sm text-gray-300 flex items-center gap-1">
                <User className="h-3 w-3" />
                {customerInfo.name}
                <span className="text-green-400 ml-2 flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Online
                </span>
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-green-900/30 text-green-400 border-green-800">
            Live Chat
          </Badge>
        </div>
      </header>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto space-y-4 pb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender_type === 'customer' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 transition-all duration-200 ${
                  message.sender_type === 'customer'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 border border-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`p-1 rounded-full ${
                    message.sender_type === 'customer' ? 'bg-white/20' : 'bg-blue-500/20'
                  }`}>
                    {message.sender_type === 'customer' ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Bot className="h-3 w-3 text-blue-400" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${
                    message.sender_type === 'customer' ? 'text-white/90' : 'text-gray-300'
                  }`}>
                    {message.sender_type === 'customer' ? customerInfo.name : 'Support'}
                  </span>
                  <span className={`text-xs ${
                    message.sender_type === 'customer' ? 'text-white/70' : 'text-gray-400'
                  }`}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`text-sm leading-relaxed ${
                  message.sender_type === 'customer' ? 'text-white' : 'text-gray-200'
                }`}>
                  {message.content}
                </div>
                {message.image_url && (
                  <div className="mt-3">
                    <img
                      src={message.image_url}
                      alt="Uploaded content"
                      className="max-w-full rounded-lg border border-gray-600"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {typing && (
            <div className="flex justify-start">
              <div className="max-w-[80%] bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="p-1 rounded-full bg-blue-500/20">
                    <Bot className="h-3 w-3 text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-300">Support</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-400">Typing...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area - MOBILE OPTIMIZED */}
      <div className="border-t border-gray-700 bg-gray-800 p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {stagedImage && (
            <div className="flex items-center justify-between bg-gray-700 border border-gray-600 rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{stagedImage.name}</p>
                  <p className="text-xs text-gray-400">Ready to send</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStagedImage(null)}
                className="h-8 w-8 hover:bg-red-900/30 hover:text-red-400"
                type="button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div className="flex items-center space-x-3">
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="h-12 w-12 flex-shrink-0 bg-gray-700 border-gray-600 hover:bg-gray-600 rounded-lg transition-colors duration-200"
              type="button"
            >
              <ImageIcon className="h-5 w-5 text-gray-300" />
            </Button>
            
            {/* MOBILE OPTIMIZED FORM */}
            <form 
              className="flex-1 relative flex items-center" 
              onSubmit={async (e) => { 
                e.preventDefault(); 
                console.log("📱 MOBILE: Form submitted via ENTER key");
                await sendMessage(); 
              }}
            >
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="h-12 bg-gray-700 border-gray-600 text-white rounded-lg pl-4 pr-12 w-full focus:border-blue-500 transition-colors"
                disabled={loading}
                enterKeyHint="send"
                inputMode="text"
              />
              <Button 
                type="submit"
                disabled={loading || (!newMessage.trim() && !stagedImage)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors duration-200 disabled:bg-gray-500"
                aria-label="Send message"
                onClick={handleSendMessageMobile}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation'
                }}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                console.log("📱 MOBILE: File input changed");
                e.target.files?.[0] && handleImageUpload(e.target.files[0]);
              }}
              capture="environment"
            />
          </div>
          
          <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-2">
            <Shield className="h-3 w-3" />
            Secure connection • Your data is protected
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerChat;