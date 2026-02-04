'use client';

import { useState } from 'react';
import { ChatSidebar } from '@/components/chat/ChatSidebar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-zinc-950">
      <ChatSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
