import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const GENERIC_LOGIN_ERROR = 'Incorrect email or password.';

export default function LoginScreen() {
  const { login, isLoadingAuth, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const result = await login(email, password);
    if (!result.ok) {
      setError(GENERIC_LOGIN_ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f2f7] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-lg rounded-[24px] bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 text-xl">
            <Lock className="w-5 h-5 text-blue-600" />
            TimeTrack Login
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-[12px]"
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
                className="rounded-[12px]"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {!error && authError && authError.type === 'auth_required' ? (
              <p className="text-sm text-red-600">{GENERIC_LOGIN_ERROR}</p>
            ) : null}
            <Button
              type="submit"
              disabled={isLoadingAuth}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-[12px]"
            >
              {isLoadingAuth ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
