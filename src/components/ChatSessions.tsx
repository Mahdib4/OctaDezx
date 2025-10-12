import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { MessageSquare, AlertTriangle, CheckCircle, Clock, Send, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

interface ChatSession {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: 'active' | 'escalated' | 'resolved' | 'manual';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('Business ID changed:', businessId);
    loadSessions();
  }, [businessId]);

  useEffect(() => {
    if (selectedSession) {
      console.log('Selected session updated:', selectedSession.id, selectedSession.status);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedSession?.messages, selectedSession?.status]);

  const loadSessions = async () => {
    try {
      console.log('Loading sessions for business:', businessId);
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
      
      const loadedSessions = data?.map(session => ({
        ...session,
        // Map database status back to our frontend status
        status: (session.status === 'escalated' ? 'manual' : session.status) as ChatSession['status'],
        messages: (session.chat_messages || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((msg: any) => ({
          ...msg,
          sender_type: msg.sender_type as 'customer' | 'ai' | 'human'
        }))
      })) || [];
      
      console.log('Loaded sessions:', loadedSessions.length);
      setSessions(loadedSessions);

      // Update selected session if it exists
      if (selectedSession) {
        const updatedSelectedSession = loadedSessions.find(s => s.id === selectedSession.id);
        if (updatedSelectedSession) {
          console.log('Updated selected session status:', updatedSelectedSession.status);
          setSelectedSession(updatedSelectedSession);
        }
      }

    } catch (error) {
      console.error('Error loading sessions:', error);
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
          content: newMessage.trim(),
        },
      ]);

      if (error) throw error;

      setNewMessage("");
      toast({
        title: "Success",
        description: "Message sent.",
      });

      loadSessions();

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive",
      });
    }
  };

  const updateSessionStatus = async (sessionId: string, status: ChatSession['status']) => {
    console.log('🔄 Updating session status:', sessionId, 'to:', status);
    
    // Map 'manual' to 'escalated' for database compatibility
    const dbStatus = status === 'manual' ? 'escalated' : status;
    console.log('📊 Using database status:', dbStatus);
    
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .update({ status: dbStatus })
        .eq("id", sessionId)
        .select();

      console.log('Update response:', data, error);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Session marked as ${status}`,
      });

      // Force reload sessions and update selected session
      await loadSessions();
      
      // Update the selected session immediately
      if (selectedSession && selectedSession.id === sessionId) {
        const updatedSession = sessions.find(s => s.id === sessionId);
        if (updatedSession) {
          setSelectedSession(updatedSession);
        }
      }

    } catch (error: any) {
      console.error('❌ Update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update session status",
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
      case 'manual':
        return <User className="h-4 w-4" />;
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
      case 'manual':
        return 'default';
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
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            console.log('Opening session:', session.id, 'status:', session.status);
                            setSelectedSession(session);
                          }}
                        >
                          View Chat
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                        <DialogHeader>
                          <DialogTitle>
                            Chat with {selectedSession?.customer_name || 'Anonymous Customer'}
                          </DialogTitle>
                          <DialogDescription>
                            {selectedSession?.customer_email} • {selectedSession && formatDistanceToNow(new Date(selectedSession.created_at))} ago
                            <br />
                            Status: <Badge variant={getStatusColor(selectedSession?.status || 'active')}>
                              {selectedSession?.status}
                            </Badge>
                          </DialogDescription>
                        </DialogHeader>
                        
                        <ScrollArea className="flex-grow pr-4">
                          <div className="space-y-4 py-4">
                            {selectedSession?.messages.map((message) => (
                              <div
                                key={message.id}
                                className={`flex ${
                                  message.sender_type === 'customer' ? 'justify-start' : 'justify-end'
                                }`}
                              >
                                <div
                                  className={`max-w-[70%] rounded-lg p-3 break-words ${
                                    message.sender_type === 'customer'
                                      ? 'bg-muted'
                                      : message.sender_type === 'ai'
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-secondary text-secondary-foreground'
                                  }`}
                                >
                                  <div className="text-xs opacity-70 mb-1 capitalize">
                                    {message.sender_type === 'customer' ? selectedSession?.customer_name || 'Customer' : message.sender_type === 'ai' ? 'AI Assistant' : 'You'}
                                  </div>
                                  <div className="text-sm">{message.content}</div>
                                  {message.image_url && (
                                    <img
                                      src={message.image_url}
                                      alt="Message attachment"
                                      className="mt-2 max-w-full rounded border"
                                    />
                                  )}
                                  <div className="text-xs opacity-70 mt-1 text-right">
                                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div ref={messagesEndRef} />
                          </div>
                        </ScrollArea>
                        
                        {selectedSession?.status === 'manual' && (
                          <div className="mt-auto flex space-x-2 pt-4 border-t">
                            <Textarea
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type your manual reply..."
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendMessage();
                                }
                              }}
                              className="flex-grow"
                            />
                            <Button 
                              onClick={handleSendMessage} 
                              disabled={!newMessage.trim()}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        
                        <div className="flex space-x-2 pt-4 border-t">
                          {selectedSession && selectedSession.status !== 'manual' && (
                            <Button 
                              onClick={() => {
                                console.log('Manual takeover clicked for:', selectedSession.id);
                                updateSessionStatus(selectedSession.id, 'manual');
                              }}
                              size="sm"
                              variant="secondary"
                            >
                              <User className="mr-2 h-4 w-4" />
                              Reply Manually
                            </Button>
                          )}
                          {selectedSession && selectedSession.status !== 'resolved' && (
                            <Button 
                              onClick={() => updateSessionStatus(selectedSession.id, 'resolved')}
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