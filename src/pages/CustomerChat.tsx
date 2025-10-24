import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Bot, Send, Image as ImageIcon, Loader2, X, Building } from "lucide-react";

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

  const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  useEffect(() => {
    if (maybeBusinessId) {
      loadBusiness();
      const existingSessionId = localStorage.getItem(`chat_session_${maybeBusinessId}`);
      if (existingSessionId) {
        setSessionId(existingSessionId);
        setIsSetup(true);
        loadMessages(existingSessionId);
      }
    }
  }, [maybeBusinessId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`chat-messages:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setMessages(prev => [...prev.filter(m => m.id !== payload.new.id), payload.new as Message]);
          if ((payload.new as Message).sender_type === 'ai') {
            setTyping(false);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const businessId = maybeBusinessId!;

  const loadBusiness = async () => {
    try {
      const { data, error } = await supabase.rpc('get_public_business', { business_id: businessId });
      if (error || !data?.length) throw new Error('Business not found');
      setBusiness(data[0]);
    } catch (e) {
      toast({ title: "Error", description: "Business not available", variant: "destructive" });
    }
  };

  const loadMessages = async (sid: string) => {
    const { data, error } = await supabase.from('chat_messages').select('*').eq('session_id', sid).order('created_at');
    if (data) setMessages(data);
  };

  const startChat = async (skip = false) => {
    if (!skip && (!customerInfo.name || !customerInfo.email)) {
      return toast({ title: "Error", description: "Please provide name and email", variant: "destructive" });
    }
    try {
      const newSessionId = generateUUID();
      const name = skip ? 'Anonymous' : customerInfo.name;
      const email = skip ? `${generateUUID()}@anon.com` : customerInfo.email;

      await supabase.from("chat_sessions").insert({ id: newSessionId, business_id: businessId, customer_name: name, customer_email: email });
      
      setCustomerInfo({ name, email });
      setSessionId(newSessionId);
      setIsSetup(true);
      localStorage.setItem(`chat_session_${businessId}`, newSessionId);

      await supabase.from("chat_messages").insert({ session_id: newSessionId, sender_type: 'ai', content: "Hello! How can I assist you today?" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to start chat.", variant: "destructive" });
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !stagedImage) || !sessionId) return;

    setLoading(true);
    const content = newMessage.trim();
    const imageFile = stagedImage;
    setNewMessage("");
    setStagedImage(null);

    // Optimistically add user message
    const tempId = generateUUID();
    const tempMessage: Message = {
      id: tempId,
      sender_type: 'customer',
      content: content || "Sending image...",
      created_at: new Date().toISOString(),
      image_url: imageFile ? URL.createObjectURL(imageFile) : undefined
    };
    setMessages(prev => [...prev, tempMessage]);
    setTyping(true);

    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const fileName = `${sessionId}/${Date.now()}_${imageFile.name}`;
        const { error: uploadError } = await supabase.storage.from('chat-files').upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from('chat-files').getPublicUrl(fileName).data.publicUrl;
      }
      
      // Overwrite optimistic message with actual data sent to backend
      const finalContent = content || (imageUrl ? "Image sent" : "");
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: finalContent, image_url: imageUrl } : m));
      
      const { error } = await supabase.functions.invoke('ai-chat-response', {
        body: { sessionId, businessId, message: finalContent, imageUrl },
      });

      if (error) throw error;

    } catch (err) {
      console.error("Message failed to send:", err);
      toast({ title: "Error", description: "Message not sent.", variant: "destructive" });
      setMessages(p => p.filter(m => m.id !== tempId)); // Rollback optimistic
      setTyping(false);
    } finally {
      setLoading(false);
    }
  };

  if (!maybeBusinessId) return <div className="h-screen flex items-center justify-center"><X /> Invalid Link</div>;
  if (!business) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin"/></div>;

  if (!isSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <Card className="w-full max-w-md bg-gray-800 text-white border-gray-700">
          <CardHeader className="text-center space-y-4"><Building className="mx-auto h-12 w-12"/><CardTitle>Chat with {business.name}</CardTitle><CardDescription>{business.description}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Input value={customerInfo.name} onChange={e => setCustomerInfo(p => ({...p, name: e.target.value}))} placeholder="Name" className="bg-gray-700"/>
            <Input type="email" value={customerInfo.email} onChange={e => setCustomerInfo(p => ({...p, email: e.target.value}))} placeholder="Email" className="bg-gray-700"/>
            <Button onClick={() => startChat(false)} className="w-full bg-blue-600">Start Chat</Button>
            <Button onClick={() => startChat(true)} variant="outline" className="w-full">Continue Anonymously</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      <header className="border-b border-gray-700 bg-gray-800 p-4"><h1 className="font-semibold text-lg">{business.name}</h1></header>
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(msg => (
            <div key={msg.id} className={`flex ${msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${msg.sender_type === 'customer' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                {msg.image_url && <img src={msg.image_url} alt="Uploaded content" className="max-w-full rounded-lg mb-2" style={{maxHeight: '300px'}}/>}
                <p>{msg.content}</p>
                <div className="text-xs text-right mt-1 opacity-60">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
          {typing && <div className="flex justify-start"><div className="p-3 bg-gray-700 rounded-lg"><Bot className="h-5 w-5 text-blue-400 animate-pulse"/></div></div>}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <div className="border-t border-gray-700 bg-gray-800 p-4">
        <div className="max-w-4xl mx-auto">
          {stagedImage && <div className="text-sm mb-2">Image: {stagedImage.name} <X className="inline h-4 w-4 cursor-pointer" onClick={() => setStagedImage(null)}/></div>}
          <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
            <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-gray-700" disabled={loading} />
            <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()}><ImageIcon/></Button>
            <Button type="submit" disabled={loading || (!newMessage.trim() && !stagedImage)}>{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}</Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && setStagedImage(e.target.files[0])}/>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerChat;
