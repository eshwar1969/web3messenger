'use client';

import React, { useState, useEffect, useRef } from 'react';
import { WalkieTalkieService } from '../services/walkie-talkie.service';

interface WalkieTalkieButtonProps {
  conversation: any;
  xmtpClient: any;
}

const WalkieTalkieButton: React.FC<WalkieTalkieButtonProps> = ({ conversation, xmtpClient }) => {
  const [isPressing, setIsPressing] = useState(false);
  const [currentBroadcaster, setCurrentBroadcaster] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const wtService = WalkieTalkieService.getInstance();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize walkie-talkie service
  useEffect(() => {
    if (conversation && xmtpClient) {
      wtService.initialize(conversation, xmtpClient).then(() => {
        setIsInitialized(true);
      }).catch(console.error);
    }

    // Refresh members periodically to catch new additions
    const refreshInterval = setInterval(() => {
      if (conversation && xmtpClient && isInitialized) {
        wtService.refreshMembers().catch(console.error);
      }
    }, 5000); // Refresh every 5 seconds

    return () => {
      clearInterval(refreshInterval);
      // Don't cleanup on unmount - keep service alive for the session
      // wtService.cleanup();
    };
  }, [conversation, xmtpClient, isInitialized]);

  // Listen for broadcast events
  useEffect(() => {
    const handleBroadcastStart = (e: CustomEvent) => {
      setCurrentBroadcaster(e.detail.broadcasterInboxId);
    };

    const handleBroadcastStop = (e: CustomEvent) => {
      if (currentBroadcaster === e.detail.broadcasterInboxId) {
        setCurrentBroadcaster(null);
      }
    };

    window.addEventListener('walkie-talkie-broadcast-start', handleBroadcastStart as EventListener);
    window.addEventListener('walkie-talkie-broadcast-stop', handleBroadcastStop as EventListener);

    return () => {
      window.removeEventListener('walkie-talkie-broadcast-start', handleBroadcastStart as EventListener);
      window.removeEventListener('walkie-talkie-broadcast-stop', handleBroadcastStop as EventListener);
    };
  }, [currentBroadcaster]);

  // Check current broadcaster periodically
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const broadcaster = wtService.getCurrentBroadcaster();
      setCurrentBroadcaster(broadcaster);
    }, 500);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleToggleBroadcast = async () => {
    if (!conversation || !xmtpClient || !isInitialized) {
      alert('Walkie-talkie not ready. Please wait...');
      return;
    }

    // If someone else is broadcasting, show alert
    const broadcaster = wtService.getCurrentBroadcaster();
    if (broadcaster && broadcaster !== xmtpClient.inboxId) {
      alert(`Someone else is currently talking. Please wait for them to finish.`);
      return;
    }

    // If currently broadcasting, stop it
    if (isPressing) {
      try {
        setIsPressing(false);
        await wtService.stopBroadcasting();
        console.log('Walkie-talkie broadcast stopped');
      } catch (error: any) {
        console.error('Error stopping broadcast:', error);
        alert(error.message || 'Failed to stop broadcast');
        setIsPressing(false);
      }
    } else {
      // Start broadcasting
      try {
        setIsPressing(true);
        await wtService.startBroadcasting();
        console.log('Walkie-talkie broadcast started');
      } catch (error: any) {
        console.error('Error starting broadcast:', error);
        alert(error.message || 'Failed to start broadcast. Please allow microphone access.');
        setIsPressing(false);
      }
    }
  };

  const isCurrentUserBroadcasting = currentBroadcaster === xmtpClient?.inboxId;
  const isSomeoneElseBroadcasting = currentBroadcaster && currentBroadcaster !== xmtpClient?.inboxId;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '0.75rem',
      padding: '1rem',
      background: 'rgba(26, 26, 26, 0.4)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)'
    }}>
      {/* Current Broadcaster Indicator */}
      {isSomeoneElseBroadcasting && (
        <div style={{
          padding: '0.5rem 1rem',
          background: 'rgba(59, 130, 246, 0.2)',
          borderRadius: '20px',
          color: '#93c5fd',
          fontSize: '0.875rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: '#3b82f6',
            animation: 'pulse 2s infinite'
          }} />
          Someone is talking...
        </div>
      )}

      {isCurrentUserBroadcasting && (
        <div style={{
          padding: '0.5rem 1rem',
          background: 'rgba(220, 38, 38, 0.2)',
          borderRadius: '20px',
          color: '#fca5a5',
          fontSize: '0.875rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: '#dc2626',
            animation: 'pulse 1s infinite'
          }} />
          You are broadcasting
        </div>
      )}

      {/* Push-to-Talk Button */}
      <button
        onClick={handleToggleBroadcast}
        disabled={!isInitialized || isSomeoneElseBroadcasting}
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: 'none',
          background: isPressing
            ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
            : isSomeoneElseBroadcasting
            ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          fontSize: '2.5rem',
          cursor: (!isInitialized || isSomeoneElseBroadcasting) ? 'not-allowed' : 'pointer',
          boxShadow: isPressing
            ? '0 0 40px rgba(220, 38, 38, 0.6)'
            : '0 4px 20px rgba(59, 130, 246, 0.4)',
          transition: 'all 0.2s ease',
          transform: isPressing ? 'scale(0.95)' : 'scale(1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          outline: 'none',
          opacity: (!isInitialized || isSomeoneElseBroadcasting) ? 0.6 : 1
        }}
        title={
          !isInitialized
            ? 'Initializing walkie-talkie...'
            : isSomeoneElseBroadcasting
            ? 'Someone else is talking. Please wait.'
            : isPressing
            ? 'Click to stop broadcasting'
            : 'Click to start broadcasting (Push-to-Talk)'
        }
        onMouseEnter={(e) => {
          if (isInitialized && !isSomeoneElseBroadcasting && !isPressing) {
            e.currentTarget.style.transform = 'scale(1.05)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isPressing) {
            e.currentTarget.style.transform = 'scale(1)';
          }
        }}
      >
        {isPressing ? '🎤' : '📻'}
      </button>

      <p style={{ 
        fontSize: '0.75rem', 
        color: 'var(--text-muted)', 
        textAlign: 'center',
        margin: 0
      }}>
        {!isInitialized
          ? 'Initializing...'
          : isSomeoneElseBroadcasting
          ? 'Wait for current speaker to finish'
          : isPressing
          ? 'Click again to stop'
          : 'Click to talk (real-time)'}
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default WalkieTalkieButton;

