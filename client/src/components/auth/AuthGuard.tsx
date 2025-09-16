import React, { useEffect, useState } from 'react';
import { useCollaboration } from '@/lib/stores/useCollaboration';
import { LoginModal } from './LoginModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Users, Share2, MessageSquare } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAuth?: boolean;
  showLoginPrompt?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  fallback,
  requireAuth = false,
  showLoginPrompt = true
}) => {
  const { isAuthenticated, user, checkAuth } = useCollaboration();
  const [isLoading, setIsLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setIsLoading(false);
    };

    initAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showLoginPrompt) {
      return (
        <>
          <Card className="max-w-md mx-auto mt-8 bg-white/95 backdrop-blur-sm border border-gray-200 dark:bg-gray-900/95 dark:border-gray-700">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Shield className="h-12 w-12 text-blue-600" />
              </div>
              <CardTitle className="text-xl text-gray-900 dark:text-gray-100">
                Authentication Required
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Please log in to access collaborative features and save your research progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Collaborate with research teams
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Share2 className="h-5 w-5 text-green-600" />
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Share discoveries with colleagues
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Add notes and annotations
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={() => setShowLogin(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Login / Register
              </Button>
              
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                You can still browse research without an account
              </div>
            </CardContent>
          </Card>

          <LoginModal 
            isOpen={showLogin} 
            onClose={() => setShowLogin(false)} 
          />
        </>
      );
    }

    return null;
  }

  return <>{children}</>;
};

// Higher-order component for protecting routes
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<AuthGuardProps, 'children'> = {}
) {
  return function AuthGuardedComponent(props: P) {
    return (
      <AuthGuard {...options}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}

// Hook for conditional rendering based on auth state
export function useAuthGuard() {
  const { isAuthenticated, user } = useCollaboration();
  
  return {
    isAuthenticated,
    user,
    canAccess: (feature: 'collaboration' | 'sharing' | 'annotations' | 'projects') => {
      switch (feature) {
        case 'collaboration':
        case 'sharing':
        case 'annotations':
        case 'projects':
          return isAuthenticated;
        default:
          return true;
      }
    }
  };
}