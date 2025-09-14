import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { subDays, format, parseISO } from 'date-fns';

interface TotalSessionsDetailProps {
  businessId: string;
}

interface DailySessionData {
  date: string;
  count: number;
}

const TotalSessionsDetail: React.FC<TotalSessionsDetailProps> = ({ businessId }) => {
  const [data, setData] = useState<DailySessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTotalSessionsData = async () => {
      setLoading(true);
      try {
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

        const { data: sessions, error } = await supabase
          .from('chat_sessions')
          .select('created_at')
          .eq('business_id', businessId)
          .gte('created_at', thirtyDaysAgo);

        if (error) throw error;

        const dailyCounts = sessions.reduce((acc, session) => {
          const date = format(parseISO(session.created_at), 'MMM d');
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const chartData = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

        setData(chartData);
      } catch (error) {
        console.error('Error fetching total sessions data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (businessId) {
      fetchTotalSessionsData();
    }
  }, [businessId]);

  if (loading) {
    return <div>Loading session details...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Sessions (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent style={{ height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="#8884d8" name="Total Sessions" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default TotalSessionsDetail;
