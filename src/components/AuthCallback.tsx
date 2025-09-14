import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/components/ui/use-toast'

const AuthCallback = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleAuthCallback = async () => {
      const code = searchParams.get('code')
      
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          
          navigate('/verification-completed')
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          })
          navigate('/auth')  // Redirect back to auth page on error
        }
      } else {
        navigate('/')
      }
      setLoading(false)
    }

    handleAuthCallback()
  }, [searchParams, navigate, toast])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Verifying your account...</div>
      </div>
    )
  }

  return null
}

export default AuthCallback