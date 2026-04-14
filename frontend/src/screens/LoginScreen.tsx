import { useState } from 'react';
import { useAuthStore } from '@/stores';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import imgIcon from '/icon.png';

export function LoginScreen() {
  const { addServer, loginWithCredentials, isLoading, error, serverLock } = useAuthStore();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serverLock) {
      await loginWithCredentials(username, password);
    } else {
      await addServer({ name, url, username, password });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-slide-up">
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl overflow-hidden flex items-center justify-center">
              <img src={imgIcon} alt="Dino" className="w-full h-full object-cover rounded-2xl" />
            </div>
            <CardTitle className="text-2xl tracking-tight">Dino</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {serverLock ? 'Sign in to continue' : 'Connect to your OpenSubsonic server'}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!serverLock && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Server Name</label>
                    <Input
                      placeholder="My Music Server"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Server URL</label>
                    <Input
                      placeholder="https://music.example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      type="url"
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Username</label>
                <Input
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <Input
                  type="password"
                  placeholder="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Connecting...' : serverLock ? 'Sign In' : 'Connect'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
