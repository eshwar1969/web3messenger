'use client';

import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ProfileService } from '../services/profile.service';

const ProfileSetup: React.FC = () => {
  const { userProfile, updateUserProfile } = useAppStore();
  const [displayName, setDisplayName] = useState(userProfile.username || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (nameToSave?: string) => {
    const name = nameToSave || displayName;
    if (!name.trim()) {
      alert('Display name cannot be empty.');
      return;
    }

    const validation = ProfileService.getInstance().validateUsername(name);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    try {
      setIsSaving(true);
      const normalized = ProfileService.getInstance().normalizeUsername(name);
      updateUserProfile({ username: normalized });
      await ProfileService.getInstance().saveProfile();
      
      // Update local state
      setDisplayName(normalized);
      
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `🪪 Display name set to @${normalized}`, type: 'success' }
      }));
    } catch (error) {
      console.error('Failed to save display name:', error);
      alert('Failed to save display name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const hasName = Boolean(userProfile.username);

  // Compact version for nav
  return (
    <button 
      className="ghost-action profile-trigger" 
      onClick={() => {
        const result = prompt('Set your display name', userProfile.username || '');
        if (result !== null && result.trim()) {
          handleSave(result);
        }
      }}
    >
      {hasName ? `@${userProfile.username}` : 'Set display name'}
    </button>
  );
};

export default ProfileSetup;

