import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Shield, Eye, EyeOff } from 'lucide-react';
import { invokeBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/utils';

const ADMIN_EMAIL = 'admin@contentflow.com';

function isEmailUnconfirmed(error: { message?: string } | null | undefined) {
  return (error?.message || '').toLowerCase().includes('email not confirmed');
}

async function signInWithPassword(email: string, password: string) {
  const first = await supabase.auth.signInWithPassword({ email, password });
  if (!isEmailUnconfirmed(first.error)) {
    return first;
  }

  await invokeBackend('auth/confirm-email', { email });
  return supabase.auth.signInWithPassword({ email, password });
}

async function syncRole(profile?: { first_name?: string; last_name?: string; phone?: string | null }) {
  return invokeBackend<{ role: string; isAdmin: boolean }>('me/sync-role', profile || {}, { method: 'POST' });
}

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'user-signin' | 'user-signup' | 'admin'>('user-signin');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please enter your first and last name.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim() || null,
          }
        }
      });
      if (error) throw error;

      if (!data.session) {
        const { error: signInError } = await signInWithPassword(email, password);
        if (signInError) throw signInError;
      }
      await syncRole({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
      });

      toast({
        title: 'Account created!',
        description: 'You are now signed in.',
      });
      navigate('/');
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: errorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let { error: authError } = await signInWithPassword(email, password);

      if (authError?.message.includes('Invalid login credentials') && email.trim().toLowerCase() === ADMIN_EMAIL) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: ADMIN_EMAIL,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              first_name: 'Admin',
              last_name: 'User',
            },
          },
        });

        if (signUpError) throw signUpError;

        const retry = await signInWithPassword(ADMIN_EMAIL, password);
        authError = retry.error;
      }

      if (authError) throw authError;

      const roleData = await syncRole({
        first_name: 'Admin',
        last_name: 'User',
      });
      if (roleData?.role !== 'admin') {
        await supabase.auth.signOut();
        toast({
          title: 'Admin access required',
          description: 'This account is not an admin.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Admin Login Successful',
        description: 'Welcome to the admin dashboard.',
      });
      navigate('/admin');
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: errorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signInWithPassword(email, password);
      if (error) throw error;
      await syncRole();
      navigate('/');
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: errorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setShowAdminPassword(false);
    setShowSignInPassword(false);
    setShowSignUpPassword(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              ContentFlow
            </span>
          </div>
          <CardTitle className="text-xl">Welcome</CardTitle>
          <CardDescription>Sign in to manage your content pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mode Selection Buttons */}
          <div className="flex gap-2 mb-6">
            <Button
              type="button"
              variant={authMode === 'user-signin' || authMode === 'user-signup' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => {
                setAuthMode('user-signin');
                resetForm();
              }}
            >
              User Sign In
            </Button>
            <Button
              type="button"
              variant={authMode === 'user-signup' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => {
                setAuthMode('user-signup');
                resetForm();
              }}
            >
              User Sign Up
            </Button>
            <Button
              type="button"
              variant={authMode === 'admin' ? 'default' : 'outline'}
              className="flex-1 flex items-center gap-2"
              onClick={() => {
                setAuthMode('admin');
                resetForm();
              }}
            >
              <Shield className="w-4 h-4" />
              Admin
            </Button>
          </div>

          {/* Admin Login Form */}
          {authMode === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-primary font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Admin Login Only
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@contentflow.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Admin Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showAdminPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-secondary pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                  >
                    {showAdminPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full glow" disabled={loading}>
                {loading ? 'Signing in...' : 'Admin Login'}
              </Button>
            </form>
          )}

          {/* User Sign In Form */}
          {authMode === 'user-signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signin-password"
                    type={showSignInPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-secondary pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowSignInPassword(!showSignInPassword)}
                  >
                    {showSignInPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                </div>
                <Button type="submit" className="w-full glow" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
          )}
            
          {/* User Sign Up Form */}
          {authMode === 'user-signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="signup-firstname">First Name</Label>
                    <Input
                      id="signup-firstname"
                      type="text"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="bg-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-lastname">Last Name</Label>
                    <Input
                      id="signup-lastname"
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="bg-secondary"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone (optional)</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showSignUpPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="bg-secondary pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                  >
                    {showSignUpPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                </div>
                <Button type="submit" className="w-full glow" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
