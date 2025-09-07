import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { MessageSquare, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";

interface ChatSession {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: 'active' | 'escalated' | 'resolved';
  escalation_reason: string | null;
  created_at: string;
  messages: Array<{
    id: string;
    sender_type: 'customer' | 'ai' | 'human';
    content: string;
    image_url: string | null;
    created_at: string;
  }>;
}

interface ChatSessionsProps {
  businessId: string;
}

const ChatSessions = ({ businessId }: ChatSessionsProps) => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    loadSessions();
  }, [businessId]);

  useEffect(() => {
    if (!selectedSession?.id) return;

    const channel = supabase
      .channel(`agent-chat-updates-${selectedSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${selectedSession.id}`,
        },
        () => {
          loadSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSession?.id]);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select(`
          *,
          chat_messages (
            id,
            sender_type,
            content,
            image_url,
            created_at
          )
        `)
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setSessions(data?.map(session => ({
        ...session,
        status: session.status as 'active' | 'escalated' | 'resolved',
        messages: (session.chat_messages || []).map((msg: any) => ({
          ...msg,
          sender_type: msg.sender_type as 'customer' | 'ai' | 'human'
        }))
      })) || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load chat sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedSession) return;

    try {
      const { error } = await supabase.from('chat_messages').insert([
        {
          session_id: selectedSession.id,
          sender_type: 'human',
          content: newMessage,
        },
      ]);

      if (error) throw error;

      setNewMessage("");
      loadSessions();
      toast({
        title: "Success",
        description: "Message sent.",
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive",
      });
    }
  };

  const updateSessionStatus = async (sessionId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .update({ status })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Session marked as ${status}`,
      });

      loadSessions();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update session status",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="h-4 w-4" />;
      case 'escalated':
        return <AlertTriangle className="h-4 w-4" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'escalated':
        return 'destructive';
      case 'resolved':
        return 'secondary';
      default:
        return 'default';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading chat sessions...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Chat Sessions</h3>
        <p className="text-sm text-muted-foreground">
          Monitor customer conversations and handle escalated cases
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No chat sessions yet. Share your chat link with customers to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {session.customer_name || 'Anonymous Customer'}
                    </CardTitle>
                    <CardDescription>
                      {session.customer_email} • {formatDistanceToNow(new Date(session.created_at))} ago
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusColor(session.status) as any} className="flex items-center space-x-1">
                      {getStatusIcon(session.status)}
                      <span className="capitalize">{session.status}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {session.messages.length} message(s)
                    {session.escalation_reason && (
                      <span className="ml-2 text-destructive">
                        • {session.escalation_reason}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedSession(session)}>
                          View Chat
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh]">
                        <DialogHeader>
                          <DialogTitle>
                            Chat with {session.customer_name || 'Anonymous Customer'}
                          </DialogTitle>
                          <DialogDescription>
                            {session.customer_email} • {formatDistanceToNow(new Date(session.created_at))} ago
                          </DialogDescription>
                        </DialogHeader>
                        
                        <ScrollArea className="h-96">
                          <div className="space-y-4 p-4">
                            {session.messages.map((message) => (
                              <div
                                key={message.id}
                                className={`flex ${
                                  message.sender_type === 'customer' ? 'justify-start' : 'justify-end'
                                }`}
                              >
                                <div
                                  className={`max-w-[70%] rounded-lg p-3 ${
                                    message.sender_type === 'customer'
                                      ? 'bg-muted'
                                      : message.sender_type === 'ai'
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-secondary'
                                  }`}
                                >
                                  <div className="text-xs opacity-70 mb-1 capitalize">
                                    {message.sender_type === 'customer' ? session.customer_name || 'Customer' : 'Customer Support'}
                                  </div>
                                  <div className="text-sm">{message.content}</div>
                                  {message.image_url && (
                                    <img
                                      src={message.image_url}
                                      alt="Message attachment"
                                      className="mt-2 max-w-full rounded border"
                                    />
                                  )}
                                  <div className="text-xs opacity-70 mt-1">
                                    {formatDistanceToNow(new Date(message.created_at))} ago
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        
                        <div className="mt-4 flex space-x-2">
                          <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          />
                          <Button onClick={handleSendMessage}>Send</Button>
                        </div>
                        
                        <div className="flex space-x-2 pt-4 border-t">
                          {session.status === 'escalated' && (
                            <Button 
                              onClick={() => updateSessionStatus(session.id, 'resolved')}
                              size="sm"
                            >
                              Mark Resolved
                            </Button>
                          )}
                          {session.status === 'active' && (
                            <Button 
                              variant="outline"
                              onClick={() => updateSessionStatus(session.id, 'resolved')}
                              size="sm"
                            >
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatSessions;
