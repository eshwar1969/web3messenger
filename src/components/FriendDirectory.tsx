'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FriendDirectoryService } from '../services/friendDirectory.service';
import { FormatUtils } from '../utils/format';

const FriendDirectory: React.FC = () => {
  const { friendDirectory, xmtpClient } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [friendUsername, setFriendUsername] = useState('');
  const [friendInboxId, setFriendInboxId] = useState('');
  const [friendType, setFriendType] = useState<'inbox' | 'address'>('inbox');

  useEffect(() => {
    FriendDirectoryService.getInstance().loadFriendDirectory();
  }, []);

  const handleAddFriend = () => {
    if (FriendDirectoryService.getInstance().addFriend(friendUsername, friendInboxId, friendType)) {
      setFriendUsername('');
      setFriendInboxId('');
      setFriendType('inbox');
    }
  };

  const handleRemoveFriend = (friendId: string) => {
    FriendDirectoryService.getInstance().removeFriend(friendId);
  };

  const handleFriendClick = (friend: any) => {
    // This could trigger a DM creation or fill the StartDM form
    console.log('Friend clicked:', friend);
  };

  const filteredFriends = friendDirectory.filter(friend => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return friend.username.toLowerCase().includes(query) || friend.value.toLowerCase().includes(query);
  });

  if (!xmtpClient) return null;

  return (
    <div className="sidebar-card" id="friendDirectory">
      <div className="card-header">
        <h2>Friend directory</h2>
        <span className="card-subtitle">Save handles mapped to inbox IDs</span>
      </div>
      <div className="profile-input compact">
        <input
          type="text"
          id="friendSearch"
          placeholder="Search @username or inbox…"
          autoComplete="off"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="friend-form">
        <input
          type="text"
          id="friendUsername"
          placeholder="@username"
          autoComplete="off"
          value={friendUsername}
          onChange={(e) => setFriendUsername(e.target.value)}
        />
        <input
          type="text"
          id="friendInboxId"
          placeholder="Inbox ID or 0x address"
          autoComplete="off"
          value={friendInboxId}
          onChange={(e) => setFriendInboxId(e.target.value)}
        />
        <div className="friend-actions">
          <select
            id="friendContactType"
            value={friendType}
            onChange={(e) => setFriendType(e.target.value as 'inbox' | 'address')}
          >
            <option value="inbox">Inbox ID</option>
            <option value="address">Ethereum address</option>
          </select>
          <button
            id="addFriendBtn"
            className="secondary-action"
            onClick={handleAddFriend}
          >
            Save friend
          </button>
        </div>
      </div>
      <div id="friendList" className="friend-list">
        {filteredFriends.length === 0 ? (
          <div className="friend-empty">
            {searchQuery ? 'No friends match that search.' : 'Save a friend above to create quick shortcuts.'}
          </div>
        ) : (
          filteredFriends.map((friend) => (
            <div
              key={friend.id}
              className="friend-item"
              onClick={() => handleFriendClick(friend)}
            >
              <div className="friend-meta">
                <span className="friend-handle">@{friend.username}</span>
                <span className="friend-hint">{friend.value}</span>
              </div>
              <div className="friend-controls">
                <span className="friend-tag">{friend.type === 'inbox' ? 'Inbox ID' : 'Ethereum'}</span>
                <button
                  className="friend-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFriend(friend.id);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FriendDirectory;

