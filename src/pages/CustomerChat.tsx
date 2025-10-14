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

      {/* Input Area */}
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
            >
              <ImageIcon className="h-5 w-5 text-gray-300" />
            </Button>
            <div className="flex-1 relative flex items-center">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                onKeyPress={(e) => e.key === 'Enter' && !loading && sendMessage()}
                className="h-12 bg-gray-700 border-gray-600 text-white rounded-lg pl-4 pr-12 w-full focus:border-blue-500 transition-colors"
                disabled={loading}
              />
              <Button 
                onClick={sendMessage} 
                disabled={loading || (!newMessage.trim() && !stagedImage)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors duration-200 disabled:bg-gray-500"
                aria-label="Send message"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
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