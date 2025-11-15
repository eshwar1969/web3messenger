'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PushToTalkService } from '../services/push-to-talk.service';

interface PushToTalkButtonProps {
  conversation: any;
  xmtpClient: any;
}

const PushToTalkButton: React.FC<PushToTalkButtonProps> = ({ conversation, xmtpClient }) => {
  const [isPressing, setIsPressing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const pttService = PushToTalkService.getInstance();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (xmtpClient) {
      pttService.setXmtpClient(xmtpClient);
    }
    if (conversation) {
      pttService.setConversation(conversation);
    }
  }, [xmtpClient, conversation]);

  useEffect(() => {
    if (isPressing) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPressing]);

  const handleToggleRecording = async () => {
    if (!conversation) {
      alert('Please select a conversation first');
      return;
    }

    // If currently recording, stop it
    if (isPressing) {
      try {
        setIsPressing(false);
        await pttService.stopRecording();
        console.log('PTT recording stopped');
        // The service will automatically send the message when recording stops
      } catch (error: any) {
        console.error('Error stopping PTT:', error);
        alert(error.message || 'Failed to stop recording');
        setIsPressing(false); // Reset state even on error
      }
    } else {
      // Start recording
      try {
        setIsPressing(true);
        await pttService.startRecording();
        console.log('PTT recording started');
      } catch (error: any) {
        console.error('Error starting PTT:', error);
        alert(error.message || 'Failed to start recording. Please allow microphone access.');
        setIsPressing(false);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '0.5rem',
      marginTop: '1rem'
    }}>
      <button
        onClick={handleToggleRecording}
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          border: 'none',
          background: isPressing 
            ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' 
            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          fontSize: '2rem',
          cursor: 'pointer',
          boxShadow: isPressing 
            ? '0 0 30px rgba(220, 38, 38, 0.6)' 
            : '0 4px 15px rgba(59, 130, 246, 0.4)',
          transition: 'all 0.2s ease',
          transform: isPressing ? 'scale(0.95)' : 'scale(1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          outline: 'none'
        }}
        disabled={!conversation}
        title={isPressing ? 'Click to stop recording' : 'Click to start recording (Push-to-Talk)'}
        onMouseEnter={(e) => {
          if (!isPressing) {
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
      
      {isPressing && (
        <div style={{
          padding: '0.5rem 1rem',
          background: 'rgba(220, 38, 38, 0.2)',
          borderRadius: '20px',
          color: '#fca5a5',
          fontSize: '0.875rem',
          fontWeight: '600'
        }}>
          🎙️ Recording: {formatTime(recordingTime)}
        </div>
      )}
      
      <p style={{ 
        fontSize: '0.75rem', 
        color: 'var(--text-muted)', 
        textAlign: 'center',
        margin: 0
      }}>
        {isPressing ? 'Click again to stop & send' : 'Click to start recording'}
      </p>
    </div>
  );
};

export default PushToTalkButton;

