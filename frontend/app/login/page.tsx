'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Loader2, Shield } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          placeholder="you@company.com"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter your password"
          className="h-11"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </Button>
    </form>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-4 w-12 bg-muted rounded animate-pulse" />
        <div className="h-11 bg-muted rounded-md animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-16 bg-muted rounded animate-pulse" />
        <div className="h-11 bg-muted rounded-md animate-pulse" />
      </div>
      <div className="h-11 bg-muted rounded-md animate-pulse" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle radial gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-background to-background" />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo + Branding */}
        <div className="text-center mb-8">
          <Image
            src="/logo.jpg"
            alt="Printerpix"
            width={64}
            height={64}
            className="rounded-2xl mx-auto mb-4 ring-2 ring-emerald-500/20 ring-offset-2 ring-offset-background"
          />
          <h1 className="text-2xl font-extrabold text-foreground">Recruiter Login</h1>
          <p className="text-muted-foreground text-sm mt-1">AI-powered hiring pipeline for Printerpix</p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6 shadow-xl shadow-black/20">
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-muted-foreground">
          <Shield className="w-3 h-3" />
          <span>Secured with Supabase Auth</span>
        </div>
      </div>
    </div>
  );
}
