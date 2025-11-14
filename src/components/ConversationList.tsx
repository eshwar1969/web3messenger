'use client';

import React from 'react';
import { useConversations } from '../hooks/useConversations';
import { useAppStore } from '../store/useAppStore';
import { FormatUtils } from '../utils/format';

const ConversationList: React.FC = () => {
  const { conversations, currentConversation, selectConversation, isLoading } = useConversations();

  const handleConversationClick = (index: number) => {
    selectConversation(index);
  };

  if (isLoading) {
    return (
      <div className="conversations-list">
        <div className="loading">Loading conversations...</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="conversations-list">
        <div className="empty-state">
          <p>No conversations yet.</p>
          <p>Start one above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversations-list">
      {conversations.map((conv: any, index: number) => {
        const isDm = conv.version === 'DM';
        const isActive = currentConversation === conv;

        let title = 'Conversation';
        let subtitle = '';

        if (isDm && conv.peerInboxId) {
          title = FormatUtils.getInstance().formatInboxId(conv.peerInboxId);
          subtitle = conv.peerInboxId;
        } else if (conv.memberInboxIds && conv.memberInboxIds.length > 0) {
          title = `Group: ${conv.id.slice(0, 8)}...`;
          subtitle = `${conv.memberInboxIds.length} members`;
        } else {
          title = `Chat: ${conv.id.slice(0, 8)}...`;
          subtitle = conv.id;
        }

        return (
          <div
            key={conv.id || index}
            className={`conversation-item ${isActive ? 'active' : ''}`}
            onClick={() => handleConversationClick(index)}
          >
            <div className="conversation-info">
              <strong>{title}</strong>
              <span className={`conv-type ${isDm ? 'dm' : 'group'}`}>
                {isDm ? 'DM' : 'GROUP'}
              </span>
            </div>
            <div className="conversation-subtitle">
              <small>{subtitle}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConversationList;
