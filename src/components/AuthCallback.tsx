import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Get the session from URL hash
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error handling callback:', error);
        navigate('/auth');
        return;
      }

      if (session) {
        navigate('/dashboard');
      } else {
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-lg">Completing authentication...</div>
    </div>
  );
};

export default AuthCallback;