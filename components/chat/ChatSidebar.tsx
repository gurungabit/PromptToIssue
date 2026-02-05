'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import {
  Plus,
  MessageSquare,
  Search,
  LogIn,
  LogOut,
  MoreHorizontal,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Share2,
  Check,
  Loader2,
} from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { useChatContext } from '@/contexts/ChatContext';

interface ChatItem {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function ChatSidebar({ collapsed, onToggle }: ChatSidebarProps) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { data: session } = useSession();

  // Use React Context instead of window events
  const { resetChat, registerChatCreatedCallback } = useChatContext();

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchChats = useCallback(async () => {
    try {
      const response = await fetch('/api/chats');
      if (response.ok) {
        const data = await response.json();
        setChats(data);
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Register callback for when new chat is created (via React Context)
  useEffect(() => {
    registerChatCreatedCallback(fetchChats);
  }, [registerChatCreatedCallback, fetchChats]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleNewChat() {
    // Use React Context to reset chat state, then navigate
    resetChat();
    router.push('/chat/new');
  }

  function handleSelectChat(id: string) {
    router.push(`/chat/${id}`);
  }

  async function handleDeleteChat(id: string) {
    try {
      const response = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setChats(chats.filter((chat) => chat.id !== id));
        // Navigate to new chat if we deleted the current chat
        if (pathname === `/chat/${id}`) {
          resetChat();
          router.push('/chat/new');
          router.refresh();
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  }

  const isDark = !mounted || resolvedTheme === 'dark';

  if (collapsed) {
    return (
      <>
        <aside
          className={`w-16 h-screen border-r flex flex-col items-center py-4 gap-3 ${
            isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
          }`}
        >
          <button
            onClick={onToggle}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title="Expand sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNewChat}
            className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
              isDark
                ? 'bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800'
                : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-100'
            }`}
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCommandOpen(true)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title="Search (⌘K)"
          >
            <Search className="w-5 h-5" />
          </button>
        </aside>
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          chats={chats}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
        />
      </>
    );
  }

  return (
    <>
      <aside
        className={`w-64 h-screen border-r flex flex-col ${
          isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
        }`}
      >
        <div className="p-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              PromptToIssue
            </span>
          </Link>
          <button
            onClick={onToggle}
            className={`p-1.5 rounded-lg ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 mb-3">
          <button
            onClick={handleNewChat}
            className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 font-medium text-sm rounded-lg border ${
              isDark
                ? 'bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800'
                : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="px-3 mb-4">
          <button
            onClick={() => setCommandOpen(true)}
            className={`w-full flex items-center gap-2 py-2 px-3 border rounded-lg text-sm ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300'
            }`}
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd
              className={`px-1.5 py-0.5 rounded text-xs ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-10 rounded-lg animate-pulse ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-200/50'}`}
                />
              ))}
            </div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center text-zinc-500 text-sm">No conversations yet</div>
          ) : (
            <div className="space-y-0.5">
              {chats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isActive={pathname === `/chat/${chat.id}`}
                  isDark={isDark}
                  onDelete={handleDeleteChat}
                />
              ))}
            </div>
          )}
        </div>

        <div className={`p-3 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
          {session?.user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 px-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-900'}`}
                >
                  {session.user.name?.charAt(0).toUpperCase() ||
                    session.user.email?.charAt(0).toUpperCase() ||
                    'U'}
                </div>
                <span
                  className={`text-sm truncate max-w-[120px] ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}
                >
                  {session.user.name || session.user.email?.split('@')[0]}
                </span>
              </div>
              <button
                onClick={() => signOut()}
                className={`p-1.5 rounded-lg ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className={`flex items-center gap-2 w-full py-2 px-3 text-sm rounded-lg ${isDark ? 'text-zinc-400 hover:bg-zinc-900 hover:text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
            >
              <LogIn className="w-4 h-4" />
              Login
            </Link>
          )}
        </div>
      </aside>
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        chats={chats}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
      />
    </>
  );
}

function ChatListItem({
  chat,
  isActive,
  isDark,
  onDelete,
}: {
  chat: ChatItem;
  isActive: boolean;
  isDark: boolean;
  onDelete: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isSharing) return;
    setIsSharing(true);

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id }),
      });

      if (response.ok) {
        const data = await response.json();
        const url = `${window.location.origin}${data.shareUrl}`;
        await navigator.clipboard.writeText(url);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
        setShowMenu(false);
      }
    } catch (error) {
      console.error('Failed to share chat:', error);
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div className="relative group">
      <Link
        href={`/chat/${chat.id}`}
        className={`flex items-center gap-2 w-full py-2 px-3 rounded-lg text-sm ${
          isActive
            ? isDark
              ? 'bg-zinc-800 text-white'
              : 'bg-zinc-200 text-zinc-900'
            : isDark
              ? 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
        }`}
      >
        <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
        <span className="flex-1 truncate">{chat.title}</span>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          setShowMenu(!showMenu);
        }}
        className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 ${
          isDark
            ? 'text-zinc-500 hover:text-white hover:bg-zinc-700'
            : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200'
        } ${showMenu ? 'opacity-100' : ''}`}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            className={`absolute right-0 top-full mt-1 z-50 w-36 py-1 border rounded-lg shadow-xl ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'}`}
          >
            <button
              onClick={handleShare}
              disabled={isSharing}
              className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm ${
                isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {showCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  Copied
                </>
              ) : isSharing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onDelete(chat.id);
              }}
              className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm text-red-500 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
