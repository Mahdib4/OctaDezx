import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';

interface AnalyticsProps {
  businessId: string;
}

interface AnalyticsData {
  totalSessions: number;
  resolvedSessions: number;
  activeSessions: number;
  escalatedSessions: number;
}

const Analytics: React.FC<AnalyticsProps> = ({ businessId }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const { data: sessions, error } = await supabase
          .from('chat_sessions')
          .select('status')
          .eq('business_id', businessId);

        if (error) throw error;

        const totalSessions = sessions.length;
        const resolvedSessions = sessions.filter(s => s.status === 'resolved').length;
        const activeSessions = sessions.filter(s => s.status === 'active').length;
        const escalatedSessions = sessions.filter(s => s.status === 'escalated').length;

        setData({ totalSessions, resolvedSessions, activeSessions, escalatedSessions });
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (businessId) {
      fetchAnalytics();
    }
  }, [businessId]);

  if (loading) {
    return <div>Loading analytics...</div>;
  }

  if (!data) {
    return <div>Could not load analytics data.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Chat Analytics</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalSessions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Sessions</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.resolvedSessions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeSessions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escalated Sessions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.escalatedSessions}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
