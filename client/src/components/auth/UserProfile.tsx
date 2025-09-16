import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCollaboration } from '@/lib/stores/useCollaboration';
import { 
  User, 
  Mail, 
  Calendar, 
  Settings, 
  LogOut, 
  Shield, 
  Activity,
  Users,
  FolderOpen,
  Share2,
  MessageSquare,
  ChevronDown
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface UserProfileProps {
  trigger?: React.ReactNode;
}

export const UserProfile: React.FC<UserProfileProps> = ({ trigger }) => {
  const { 
    user, 
    logout, 
    projects, 
    teams, 
    activityFeed,
    connectionStatus,
    activeUsers 
  } = useCollaboration();
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  if (!user) return null;

  const defaultTrigger = (
    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
      <Avatar className="h-8 w-8">
        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`} />
        <AvatarFallback>
          {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </Button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || defaultTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-4 bg-white/95 backdrop-blur-sm border border-gray-200 dark:bg-gray-900/95 dark:border-gray-700" align="end">
        <div className="flex items-center space-x-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`} />
            <AvatarFallback>
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {user.fullName || user.username}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              @{user.username}
            </p>
            <div className="flex items-center mt-1">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {connectionStatus}
              </span>
            </div>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {projects.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Projects</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {teams.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Teams</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {activeUsers.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
          </div>
        </div>

        <Separator className="my-3" />

        <DropdownMenuLabel className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Quick Actions
        </DropdownMenuLabel>
        
        <DropdownMenuItem 
          onClick={() => setIsOpen(true)}
          className="flex items-center cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>Profile Settings</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem className="flex items-center cursor-pointer">
          <Activity className="mr-2 h-4 w-4" />
          <span>Activity</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={logout}
          className="flex items-center cursor-pointer text-red-600 dark:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Detailed Profile Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto bg-white/95 backdrop-blur-sm border border-gray-200 dark:bg-gray-900/95 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`} />
                <AvatarFallback>
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {user.fullName || user.username}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  @{user.username}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-gray-800">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400">Username</Label>
                      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.username}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400">Full Name</Label>
                      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.fullName || 'Not set'}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Email</Label>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user.email}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Member Since</Label>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className={`w-2 h-2 rounded-full ${
                      connectionStatus === 'connected' ? 'bg-green-500' : 
                      connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {connectionStatus}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="projects" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FolderOpen className="mr-2 h-4 w-4" />
                      My Projects ({projects.length})
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {projects.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      No projects yet. Create your first research project!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {projects.slice(0, 5).map((project) => (
                        <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg border-gray-200 dark:border-gray-700">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {project.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Updated {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'Unknown'}
                            </div>
                          </div>
                          <Badge variant={project.isPublic ? 'default' : 'secondary'}>
                            {project.isPublic ? 'Public' : 'Private'}
                          </Badge>
                        </div>
                      ))}
                      {projects.length > 5 && (
                        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                          And {projects.length - 5} more...
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="teams" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="mr-2 h-4 w-4" />
                    My Teams ({teams.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teams.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      Not part of any teams yet. Join or create a team!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {teams.map((team) => (
                        <div key={team.id} className="flex items-center justify-between p-3 border rounded-lg border-gray-200 dark:border-gray-700">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {team.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Team member
                            </div>
                          </div>
                          <Badge variant="secondary">
                            Member
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="mr-2 h-4 w-4" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activityFeed.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      No recent activity
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activityFeed.slice(0, 10).map((activity) => (
                        <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded-lg border-gray-200 dark:border-gray-700">
                          <div className="flex-shrink-0">
                            {activity.action === 'create' && <FolderOpen className="h-4 w-4 text-green-500" />}
                            {activity.action === 'update' && <Settings className="h-4 w-4 text-blue-500" />}
                            {activity.action === 'delete' && <LogOut className="h-4 w-4 text-red-500" />}
                            {activity.action === 'share' && <Share2 className="h-4 w-4 text-purple-500" />}
                            {activity.action === 'comment' && <MessageSquare className="h-4 w-4 text-orange-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                              {(activity.details as any)?.event || `${activity.action} ${activity.targetType}`}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : 'Unknown'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
};