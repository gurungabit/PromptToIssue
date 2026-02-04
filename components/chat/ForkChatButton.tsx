'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitFork, Loader2 } from 'lucide-react';

interface ForkChatButtonProps {
  shareId: string;
}

export function ForkChatButton({ shareId }: ForkChatButtonProps) {
  const router = useRouter();
  const [isForking, setIsForking] = useState(false);

  async function handleFork() {
    setIsForking(true);
    try {
      const response = await fetch('/api/chats/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/chat/${data.newChatId}`);
      } else {
        console.error('Failed to fork chat');
      }
    } catch (error) {
      console.error('Error forking chat:', error);
    } finally {
      setIsForking(false);
    }
  }

  return (
    <button
      onClick={handleFork}
      disabled={isForking}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isForking ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Forking...
        </>
      ) : (
        <>
          <GitFork className="w-4 h-4" />
          Fork this Chat
        </>
      )}
    </button>
  );
}
