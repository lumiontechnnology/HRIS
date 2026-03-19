'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoginPage from '@/components/ui/auth-login';
import { createClient } from '@/lib/supabase/client';

const videoUrl = 'https://videos.pexels.com/video-files/3196003/3196003-uhd_2560_1440_25fps.mp4';

export default function SignInPage(): JSX.Element {
  const supabase = createClient();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (email: string, password: string, remember: boolean): Promise<void> => {
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMessage(error.message);
      throw error;
    }

    if (typeof window !== 'undefined') {
      if (remember) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center px-4">
      <LoginPage.VideoBackground videoUrl={videoUrl} />
      <div className="relative z-20 w-full max-w-sm">
        <LoginPage.LoginForm onSubmit={handleLogin} errorMessage={errorMessage} />
      </div>
    </div>
  );
}
