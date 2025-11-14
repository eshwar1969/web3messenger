'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import HomePage from '../pages/HomePage';
import ConnectPage from '../pages/ConnectPage';
import ChatPage from '../pages/ChatPage';
import { ProfileService } from '../services/profile.service';

const MessengerApp: React.FC = () => {
  const pathname = usePathname();

  useEffect(() => {
    ProfileService.getInstance().loadUserProfile();
    ProfileService.getInstance().loadTheme();
  }, []);

  // Route handling
  if (pathname === '/connect') {
    return <ConnectPage />;
  }

  if (pathname === '/chat') {
    return <ChatPage />;
  }

  // Default to home
  return <HomePage />;
};

export default MessengerApp;

